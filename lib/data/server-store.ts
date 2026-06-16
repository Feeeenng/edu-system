import "server-only";
import { BlobPreconditionFailedError, get, put } from "@vercel/blob";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { dedupeDeliveries } from "@/lib/data/dedupe";
import { createDeliveryRecord } from "@/lib/data/normalize";
import {
  readSqliteRecords,
  readSqliteSiteConfig,
  writeSqliteRecords,
  writeSqliteSiteConfig,
} from "@/lib/data/sqlite-store";
import {
  readSupabaseRecords,
  readSupabaseSiteConfig,
  writeSupabaseRecords,
  writeSupabaseSiteConfig,
} from "@/lib/data/supabase-store";
import { validateDeliveryRecordShape } from "@/lib/data/validation";
import { DEFAULT_SITE_CONFIG, normalizeSiteConfig, validateSiteConfigPayload } from "@/lib/site-config";
import type { DeliveryPayload, DeliveryRecord, SiteConfig } from "@/lib/types";

const LOCAL_DATA_PATH = path.join(process.cwd(), "data", "deliveries.local.json");
const LOCAL_SITE_CONFIG_PATH = path.join(process.cwd(), "data", "site-config.local.json");
const BLOB_KEY = "edu-system/deliveries.json";
const BLOB_SITE_CONFIG_KEY = "edu-system/site-config.json";
const BLOB_WRITE_RETRIES = 2;

type StoreSnapshot = {
  records: DeliveryRecord[];
  etag?: string;
};

type SiteConfigSnapshot = {
  config: SiteConfig;
  etag?: string;
};

type ServerRecordsMutator = (records: DeliveryRecord[]) => DeliveryRecord[] | Promise<DeliveryRecord[]>;

let localMutationQueue: Promise<unknown> = Promise.resolve();
let sqliteMutationQueue: Promise<unknown> = Promise.resolve();
let supabaseMutationQueue: Promise<unknown> = Promise.resolve();

function hasSupabaseConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

function shouldUseSupabaseStore() {
  return process.env.DATA_STORE === "supabase" || hasSupabaseConfig();
}

function shouldUseSqliteStore() {
  return process.env.DATA_STORE === "sqlite";
}

function shouldUseBlobStore() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN && process.env.VERCEL);
}

function assertVercelStoreConfigured() {
  if (process.env.VERCEL && !shouldUseSupabaseStore() && !shouldUseSqliteStore() && !shouldUseBlobStore()) {
    throw new Error("Vercel 数据源未配置：请设置 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }
}

function isMissingFileError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function parseRecordArray(raw: string, source: string): DeliveryRecord[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${source}损坏：JSON 格式错误`, { cause: error });
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`${source}损坏：内容必须是数组`);
  }

  for (let index = 0; index < parsed.length; index += 1) {
    const result = validateDeliveryRecordShape(parsed[index]);
    if (!result.ok) {
      throw new Error(`${source}损坏：第 ${index + 1} 条记录${result.error}`);
    }
  }

  return dedupeDeliveries(parsed as DeliveryRecord[]);
}

function parseSiteConfig(raw: string, source: string): SiteConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${source}损坏：JSON 格式错误`, { cause: error });
  }

  const result = validateSiteConfigPayload(parsed);
  if (!result.ok) {
    throw new Error(`${source}损坏：${result.error}`);
  }

  return result.config;
}

function assertWritableStoreConfigured() {
  if (shouldUseSupabaseStore()) return;
  if (shouldUseSqliteStore()) return;
  assertVercelStoreConfigured();
}

export async function readLocalDeliveryRecords(filePath = LOCAL_DATA_PATH): Promise<DeliveryRecord[]> {
  try {
    const raw = await readFile(filePath, "utf8");
    return parseRecordArray(raw, "本地交付数据文件");
  } catch (error) {
    if (isMissingFileError(error)) return [];
    throw error;
  }
}

export async function writeLocalDeliveryRecords(records: DeliveryRecord[], filePath = LOCAL_DATA_PATH) {
  assertWritableStoreConfigured();
  assertValidRecordArray(records, "本地交付数据");
  const dir = path.dirname(filePath);
  const tempPath = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  await mkdir(dir, { recursive: true });
  await writeFile(tempPath, JSON.stringify(records, null, 2), "utf8");
  await rename(tempPath, filePath);
}

export async function readLocalSiteConfig(filePath = LOCAL_SITE_CONFIG_PATH): Promise<SiteConfig> {
  try {
    const raw = await readFile(filePath, "utf8");
    return parseSiteConfig(raw, "本地站点配置文件");
  } catch (error) {
    if (isMissingFileError(error)) return DEFAULT_SITE_CONFIG;
    throw error;
  }
}

export async function writeLocalSiteConfig(config: SiteConfig, filePath = LOCAL_SITE_CONFIG_PATH) {
  assertWritableStoreConfigured();
  const validation = validateSiteConfigPayload(config);
  if (!validation.ok) throw new Error(validation.error);

  const normalized = normalizeSiteConfig(validation.config);
  const dir = path.dirname(filePath);
  const tempPath = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  await mkdir(dir, { recursive: true });
  await writeFile(tempPath, JSON.stringify(normalized, null, 2), "utf8");
  await rename(tempPath, filePath);
  return normalized;
}

function assertValidRecordArray(records: DeliveryRecord[], source: string) {
  parseRecordArray(JSON.stringify(records), source);
}

async function streamToText(stream: ReadableStream<Uint8Array>) {
  return new Response(stream).text();
}

async function readBlobSnapshot(): Promise<StoreSnapshot> {
  const result = await get(BLOB_KEY, { access: "private", useCache: false });
  if (!result) return { records: [] };

  if (result.statusCode === 304 || !result.stream) {
    throw new Error("Vercel Blob 交付数据读取失败：未返回内容");
  }

  return {
    records: parseRecordArray(await streamToText(result.stream), "Vercel Blob 交付数据"),
    etag: result.blob.etag || undefined,
  };
}

async function readBlobSiteConfigSnapshot(): Promise<SiteConfigSnapshot> {
  const result = await get(BLOB_SITE_CONFIG_KEY, { access: "private", useCache: false });
  if (!result) return { config: DEFAULT_SITE_CONFIG };

  if (result.statusCode === 304 || !result.stream) {
    throw new Error("Vercel Blob 站点配置读取失败：未返回内容");
  }

  return {
    config: parseSiteConfig(await streamToText(result.stream), "Vercel Blob 站点配置"),
    etag: result.blob.etag || undefined,
  };
}

async function readBlobRecords(): Promise<DeliveryRecord[]> {
  return (await readBlobSnapshot()).records;
}

async function readBlobSiteConfig(): Promise<SiteConfig> {
  return (await readBlobSiteConfigSnapshot()).config;
}

function blobWriteOptions(etag?: string) {
  return {
    access: "private" as const,
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
    ...(etag ? { ifMatch: etag } : {}),
  };
}

async function writeBlobRecords(records: DeliveryRecord[], etag?: string) {
  assertValidRecordArray(records, "Vercel Blob 交付数据");
  await put(BLOB_KEY, JSON.stringify(records, null, 2), {
    ...blobWriteOptions(etag),
  });
}

async function writeBlobSiteConfig(config: SiteConfig, etag?: string) {
  const validation = validateSiteConfigPayload(config);
  if (!validation.ok) throw new Error(validation.error);

  await put(BLOB_SITE_CONFIG_KEY, JSON.stringify(normalizeSiteConfig(validation.config), null, 2), {
    ...blobWriteOptions(etag),
  });
  return validation.config;
}

function isBlobPreconditionFailed(error: unknown) {
  return error instanceof BlobPreconditionFailedError || error?.constructor?.name === "BlobPreconditionFailedError";
}

async function mutateBlobRecords(mutator: ServerRecordsMutator) {
  for (let attempt = 0; attempt <= BLOB_WRITE_RETRIES; attempt += 1) {
    const snapshot = await readBlobSnapshot();
    const records = await mutator(snapshot.records);

    try {
      await writeBlobRecords(records, snapshot.etag);
      return records;
    } catch (error) {
      if (isBlobPreconditionFailed(error) && attempt < BLOB_WRITE_RETRIES) {
        continue;
      }

      if (isBlobPreconditionFailed(error)) {
        throw new Error("交付数据已被其他写入更新，请刷新后重试", { cause: error });
      }

      throw error;
    }
  }

  throw new Error("交付数据已被其他写入更新，请刷新后重试");
}

async function mutateBlobSiteConfig(config: SiteConfig) {
  for (let attempt = 0; attempt <= BLOB_WRITE_RETRIES; attempt += 1) {
    const snapshot = await readBlobSiteConfigSnapshot();

    try {
      await writeBlobSiteConfig(config, snapshot.etag);
      return normalizeSiteConfig(config);
    } catch (error) {
      if (isBlobPreconditionFailed(error) && attempt < BLOB_WRITE_RETRIES) {
        continue;
      }

      if (isBlobPreconditionFailed(error)) {
        throw new Error("站点配置已被其他写入更新，请刷新后重试", { cause: error });
      }

      throw error;
    }
  }

  throw new Error("站点配置已被其他写入更新，请刷新后重试");
}

function enqueueLocalMutation<T>(operation: () => Promise<T>) {
  const next = localMutationQueue.then(operation, operation);
  localMutationQueue = next.catch(() => undefined);
  return next;
}

async function mutateLocalRecords(mutator: ServerRecordsMutator) {
  return enqueueLocalMutation(async () => {
    const records = await readLocalDeliveryRecords();
    const nextRecords = await mutator(records);
    await writeLocalDeliveryRecords(nextRecords);
    return nextRecords;
  });
}

function enqueueSqliteMutation<T>(operation: () => Promise<T>) {
  const next = sqliteMutationQueue.then(operation, operation);
  sqliteMutationQueue = next.catch(() => undefined);
  return next;
}

async function mutateSqliteRecords(mutator: ServerRecordsMutator) {
  return enqueueSqliteMutation(async () => {
    const records = await readSqliteRecords();
    const nextRecords = await mutator(records);
    await writeSqliteRecords(nextRecords);
    return nextRecords;
  });
}

function enqueueSupabaseMutation<T>(operation: () => Promise<T>) {
  const next = supabaseMutationQueue.then(operation, operation);
  supabaseMutationQueue = next.catch(() => undefined);
  return next;
}

async function mutateSupabaseRecords(mutator: ServerRecordsMutator) {
  return enqueueSupabaseMutation(async () => {
    const records = await readSupabaseRecords();
    const nextRecords = await mutator(records);
    return writeSupabaseRecords(nextRecords);
  });
}

export async function readServerRecords(): Promise<DeliveryRecord[]> {
  if (shouldUseSupabaseStore()) return readSupabaseRecords();
  if (shouldUseSqliteStore()) return readSqliteRecords();
  if (shouldUseBlobStore()) return readBlobRecords();
  assertVercelStoreConfigured();
  return readLocalDeliveryRecords();
}

export async function readServerSiteConfig(): Promise<SiteConfig> {
  if (shouldUseSupabaseStore()) return readSupabaseSiteConfig();
  if (shouldUseSqliteStore()) return readSqliteSiteConfig();
  if (shouldUseBlobStore()) return readBlobSiteConfig();
  assertVercelStoreConfigured();
  return readLocalSiteConfig();
}

export async function writeServerRecords(records: DeliveryRecord[]) {
  await mutateServerRecords(() => records);
}

export async function writeServerSiteConfig(config: SiteConfig) {
  const validation = validateSiteConfigPayload(config);
  if (!validation.ok) throw new Error(validation.error);

  if (shouldUseSupabaseStore()) return writeSupabaseSiteConfig(validation.config);
  if (shouldUseSqliteStore()) return writeSqliteSiteConfig(validation.config);
  if (shouldUseBlobStore()) return mutateBlobSiteConfig(validation.config);
  return writeLocalSiteConfig(validation.config);
}

export async function mutateServerRecords(mutator: ServerRecordsMutator) {
  if (shouldUseSupabaseStore()) return mutateSupabaseRecords(mutator);
  if (shouldUseSqliteStore()) return mutateSqliteRecords(mutator);
  return shouldUseBlobStore() ? mutateBlobRecords(mutator) : mutateLocalRecords(mutator);
}

export async function replaceServerRecords(payloads: DeliveryPayload[]) {
  const records = dedupeDeliveries(payloads.map(createDeliveryRecord));
  return mutateServerRecords(() => records);
}
