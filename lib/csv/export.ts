import Papa from "papaparse";
import { CSV_COLUMNS } from "@/lib/csv/schema";
import type { DeliveryPayload, DeliveryRecord } from "@/lib/types";

function formatValue(record: DeliveryPayload | DeliveryRecord, key: keyof DeliveryPayload) {
  const value = record[key];
  if (Array.isArray(value)) return value.join(";");
  if (key === "extraJson" && value && typeof value === "object") return JSON.stringify(value);
  return value ?? "";
}

export function buildCsvTemplate(): string {
  return Papa.unparse({
    fields: CSV_COLUMNS.map((column) => column.label),
    data: [],
  });
}

export function exportDeliveriesToCsv(records: Array<DeliveryPayload | DeliveryRecord>): string {
  return Papa.unparse({
    fields: CSV_COLUMNS.map((column) => column.label),
    data: records.map((record) => CSV_COLUMNS.map((column) => formatValue(record, column.key))),
  });
}
