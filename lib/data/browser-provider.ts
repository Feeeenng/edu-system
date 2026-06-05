"use client";

import { createDeliveryRecord } from "@/lib/data/normalize";
import type { DeliveryDataProvider } from "@/lib/data/provider";
import { validateDeliveryRecordShape } from "@/lib/data/validation";
import type { DeliveryPayload, DeliveryRecord } from "@/lib/types";

const STORAGE_KEY = "edu-system.deliveries";
const CORRUPT_STORAGE_ERROR = "本地浏览器数据损坏，请先导出/清理后再写入";

type BrowserReadResult =
  | { status: "missing"; records: DeliveryRecord[] }
  | { status: "valid"; records: DeliveryRecord[] }
  | { status: "corrupt"; records: DeliveryRecord[] };

function readRecords(): BrowserReadResult {
  if (typeof window === "undefined") return { status: "missing", records: [] };
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return { status: "missing", records: [] };
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return { status: "corrupt", records: [] };
    }

    if (parsed.some((record) => !validateDeliveryRecordShape(record).ok)) {
      return { status: "corrupt", records: [] };
    }

    return { status: "valid", records: parsed };
  } catch {
    return { status: "corrupt", records: [] };
  }
}

function writeRecords(records: DeliveryRecord[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function readWritableRecords() {
  const current = readRecords();
  if (current.status === "corrupt") {
    throw new Error(CORRUPT_STORAGE_ERROR);
  }
  return current.records;
}

export function createBrowserProvider(seed: DeliveryRecord[] = []): DeliveryDataProvider {
  return {
    async list() {
      const current = readRecords();
      if (current.status === "corrupt") {
        return seed;
      }
      if (current.status === "missing" && seed.length > 0) {
        writeRecords(seed);
        return seed;
      }
      return current.records;
    },
    async replaceAll(payloads) {
      readWritableRecords();
      const records = payloads.map(createDeliveryRecord);
      writeRecords(records);
      return records;
    },
    async create(payload) {
      const records = readWritableRecords();
      const record = createDeliveryRecord(payload);
      writeRecords([record, ...records]);
      return record;
    },
    async update(id: string, payload: DeliveryPayload) {
      const records = readWritableRecords();
      const updated = createDeliveryRecord({ ...payload, id, updatedAt: new Date().toISOString() });
      writeRecords(records.map((record) => (record.id === id ? updated : record)));
      return updated;
    },
    async remove(id: string) {
      writeRecords(readWritableRecords().filter((record) => record.id !== id));
    },
  };
}
