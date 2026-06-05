import { del, list, put } from "@vercel/blob";
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

async function readLocalRecords(): Promise<DeliveryRecord[]> {
  try {
    const raw = await readFile(LOCAL_DATA_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : mockDeliveries;
  } catch {
    return mockDeliveries;
  }
}

async function writeLocalRecords(records: DeliveryRecord[]) {
  await mkdir(path.dirname(LOCAL_DATA_PATH), { recursive: true });
  await writeFile(LOCAL_DATA_PATH, JSON.stringify(records, null, 2), "utf8");
}

async function readBlobRecords(): Promise<DeliveryRecord[]> {
  const blobs = await list({ prefix: BLOB_KEY, limit: 1 });
  const target = blobs.blobs.find((blob) => blob.pathname === BLOB_KEY);
  if (!target) return mockDeliveries;
  const response = await fetch(target.url, { cache: "no-store" });
  const parsed = await response.json();
  return Array.isArray(parsed) ? parsed : mockDeliveries;
}

async function writeBlobRecords(records: DeliveryRecord[]) {
  await del(BLOB_KEY).catch(() => undefined);
  await put(BLOB_KEY, JSON.stringify(records, null, 2), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
  });
}

export async function readServerRecords(): Promise<DeliveryRecord[]> {
  return shouldUseBlobStore() ? readBlobRecords() : readLocalRecords();
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
