import { list, put } from "@vercel/blob";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createDeliveryRecord } from "@/lib/data/normalize";
import { mockDeliveries } from "@/lib/mock/deliveries";
import type { DeliveryPayload, DeliveryRecord } from "@/lib/types";

const LOCAL_DATA_PATH = path.join(process.cwd(), "data", "deliveries.local.json");
const BLOB_KEY = "edu-system/deliveries.json";

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

async function writeLocalRecords(records: DeliveryRecord[]) {
  assertWritableStoreConfigured();
  await mkdir(path.dirname(LOCAL_DATA_PATH), { recursive: true });
  await writeFile(LOCAL_DATA_PATH, JSON.stringify(records, null, 2), "utf8");
}

async function readBlobRecords(): Promise<DeliveryRecord[]> {
  const blobs = await list({ prefix: BLOB_KEY, limit: 1 });
  const target = blobs.blobs.find((blob) => blob.pathname === BLOB_KEY);
  if (!target) return mockDeliveries;

  const response = await fetch(target.url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Vercel Blob 交付数据读取失败：HTTP ${response.status}`);
  }

  return parseRecordArray(await response.text(), "Vercel Blob 交付数据");
}

async function writeBlobRecords(records: DeliveryRecord[]) {
  await put(BLOB_KEY, JSON.stringify(records, null, 2), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
  });
}

export async function readServerRecords(): Promise<DeliveryRecord[]> {
  return shouldUseBlobStore() ? readBlobRecords() : readLocalDeliveryRecords();
}

export async function writeServerRecords(records: DeliveryRecord[]) {
  if (shouldUseBlobStore()) {
    await writeBlobRecords(records);
  } else {
    await writeLocalRecords(records);
  }
}

export async function replaceServerRecords(payloads: DeliveryPayload[]) {
  const records = payloads.map(createDeliveryRecord);
  await writeServerRecords(records);
  return records;
}
