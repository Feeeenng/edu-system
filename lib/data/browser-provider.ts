"use client";

import { createDeliveryRecord } from "@/lib/data/normalize";
import type { DeliveryDataProvider } from "@/lib/data/provider";
import type { DeliveryPayload, DeliveryRecord } from "@/lib/types";

const STORAGE_KEY = "edu-system.deliveries";

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
    return Array.isArray(parsed) ? { status: "valid", records: parsed } : { status: "corrupt", records: [] };
  } catch {
    return { status: "corrupt", records: [] };
  }
}

function writeRecords(records: DeliveryRecord[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function createBrowserProvider(seed: DeliveryRecord[] = []): DeliveryDataProvider {
  return {
    async list() {
      const current = readRecords();
      if (current.status === "corrupt") {
        return seed;
      }
      if (current.records.length === 0 && seed.length > 0) {
        writeRecords(seed);
        return seed;
      }
      return current.records;
    },
    async replaceAll(payloads) {
      const records = payloads.map(createDeliveryRecord);
      writeRecords(records);
      return records;
    },
    async create(payload) {
      const records = readRecords().records;
      const record = createDeliveryRecord(payload);
      writeRecords([record, ...records]);
      return record;
    },
    async update(id: string, payload: DeliveryPayload) {
      const records = readRecords().records;
      const updated = createDeliveryRecord({ ...payload, id, updatedAt: new Date().toISOString() });
      writeRecords(records.map((record) => (record.id === id ? updated : record)));
      return updated;
    },
    async remove(id: string) {
      writeRecords(readRecords().records.filter((record) => record.id !== id));
    },
  };
}
