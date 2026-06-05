import Papa from "papaparse";
import { resolveColumnKey } from "@/lib/csv/schema";
import type { DeliveryPayload } from "@/lib/types";

export type CsvParseResult = {
  records: DeliveryPayload[];
  errors: string[];
};

function splitTags(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(/[;；]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseExtraJson(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function parseDeliveryCsv(csvText: string): CsvParseResult {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  const errors: string[] = [];
  const records: DeliveryPayload[] = [];

  parsed.data.forEach((row, index) => {
    const line = index + 2;
    const normalized: Partial<Record<keyof DeliveryPayload, string>> = {};

    for (const [header, value] of Object.entries(row)) {
      const key = resolveColumnKey(header);
      if (key) normalized[key] = value;
    }

    const missing = [
      ["province", "省份"],
      ["city", "地区/城市"],
      ["university", "高校名称"],
    ].filter(([key]) => !normalized[key as keyof DeliveryPayload]?.trim());

    if (missing.length > 0) {
      errors.push(`第 ${line} 行缺少必填字段：${missing.map((item) => item[1]).join("、")}`);
      return;
    }

    records.push({
      province: normalized.province!.trim(),
      city: normalized.city!.trim(),
      university: normalized.university!.trim(),
      longitude: parseNumber(normalized.longitude),
      latitude: parseNumber(normalized.latitude),
      customerStatus: normalized.customerStatus?.trim(),
      coverageStatus: normalized.coverageStatus?.trim() as DeliveryPayload["coverageStatus"],
      projectStage: normalized.projectStage?.trim() as DeliveryPayload["projectStage"],
      deliveryDate: normalized.deliveryDate?.trim(),
      owner: normalized.owner?.trim(),
      purchaseTags: splitTags(normalized.purchaseTags),
      productTags: splitTags(normalized.productTags),
      resourceType: normalized.resourceType?.trim(),
      resourceAmount: parseNumber(normalized.resourceAmount),
      resourceUnit: normalized.resourceUnit?.trim(),
      deliveryContent: normalized.deliveryContent?.trim(),
      notes: normalized.notes?.trim(),
      extraJson: parseExtraJson(normalized.extraJson),
    });
  });

  return { records, errors };
}
