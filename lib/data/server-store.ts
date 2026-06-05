import "server-only";
import { BlobPreconditionFailedError, get, put } from "@vercel/blob";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { createDeliveryRecord } from "@/lib/data/normalize";
import { validateDeliveryRecordShape } from "@/lib/data/validation";
import { mockDeliveries } from "@/lib/mock/deliveries";
import type { DeliveryPayload, DeliveryRecord } from "@/lib/types";

const LOCAL_DATA_PATH = path.join(process.cwd(), "data", "deliveries.local.json");
const BLOB_KEY = "edu-system/deliveries.json";
const BLOB_WRITE_RETRIES = 2;

type StoreSnapshot = {
  records: DeliveryRecord[];
  etag?: string;
};

type ServerRecordsMutator = (records: DeliveryRecord[]) => DeliveryRecord[] | Promise<DeliveryRecord[]>;

let localMutationQueue: Promise<unknown> = Promise.resolve();

function shouldUseBlobStore() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN && process.env.VERCEL);
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

  return parsed as DeliveryRecord[];
}

function assertWritableStoreConfigured() {
  if (process.env.VERCEL && !process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("Vercel Blob 未配置 BLOB_READ_WRITE_TOKEN，无法持久化交付数据");
  }
}

export async function readLocalDeliveryRecords(filePath = LOCAL_DATA_PATH): Promise<DeliveryRecord[]> {
  try {
    const raw = await readFile(filePath, "utf8");
    return parseRecordArray(raw, "本地交付数据文件");
  } catch (error) {
    if (isMissingFileError(error)) return mockDeliveries;
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

function assertValidRecordArray(records: DeliveryRecord[], source: string) {
  parseRecordArray(JSON.stringify(records), source);
}

async function streamToText(stream: ReadableStream<Uint8Array>) {
  return new Response(stream).text();
}

async function readBlobSnapshot(): Promise<StoreSnapshot> {
  const result = await get(BLOB_KEY, { access: "private", useCache: false });
  if (!result) return { records: mockDeliveries };

  if (result.statusCode === 304 || !result.stream) {
    throw new Error("Vercel Blob 交付数据读取失败：未返回内容");
  }

  return {
    records: parseRecordArray(await streamToText(result.stream), "Vercel Blob 交付数据"),
    etag: result.blob.etag || undefined,
  };
}

async function readBlobRecords(): Promise<DeliveryRecord[]> {
  return (await readBlobSnapshot()).records;
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

export async function readServerRecords(): Promise<DeliveryRecord[]> {
  return shouldUseBlobStore() ? readBlobRecords() : readLocalDeliveryRecords();
}

export async function writeServerRecords(records: DeliveryRecord[]) {
  await mutateServerRecords(() => records);
}

export async function mutateServerRecords(mutator: ServerRecordsMutator) {
  return shouldUseBlobStore() ? mutateBlobRecords(mutator) : mutateLocalRecords(mutator);
}

export async function replaceServerRecords(payloads: DeliveryPayload[]) {
  const records = payloads.map(createDeliveryRecord);
  return mutateServerRecords(() => records);
}
