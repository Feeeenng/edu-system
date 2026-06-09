import Papa, { type ParseError } from "papaparse";
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

function trimText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function formatPapaError(error: ParseError): string {
  const line =
    typeof error.row === "number" ? error.row + (error.type === "FieldMismatch" ? 2 : 1) : 1;
  return `第 ${line} 行 CSV 解析错误（${error.code}）：${error.message}`;
}

function parseNumberField(value: unknown, label: string, errors: string[]): number | undefined {
  const normalized = trimText(value);
  if (normalized === undefined) return undefined;

  const parsed = Number(normalized);
  if (Number.isFinite(parsed)) return parsed;

  errors.push(`${label}必须是有效数字`);
  return undefined;
}

function parseExtraJson(value: unknown, errors: string[]): Record<string, unknown> | undefined {
  const normalized = trimText(value);
  if (normalized === undefined) return undefined;

  try {
    const parsed = JSON.parse(normalized);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // 统一在下方返回字段级错误，避免把非法 JSON 静默丢弃。
  }

  errors.push("扩展字段JSON必须是合法 JSON 对象");
  return undefined;
}

function parseEnumField<T extends string>(
  value: unknown,
  label: string,
  validValues: readonly T[],
  errors: string[],
): T | undefined {
  const normalized = trimText(value);
  if (normalized === undefined) return undefined;

  if (validValues.includes(normalized as T)) return normalized as T;

  errors.push(`${label}必须是以下值之一：${validValues.join("、")}`);
  return undefined;
}

const COVERAGE_STATUSES = ["已覆盖", "跟进中", "未覆盖", "暂停", "已下单", "新增商机"] as const;
const PROJECT_STAGES = ["线索", "测试", "方案", "交付", "运维"] as const;

function parseFieldMismatchRow(error: ParseError): number | undefined {
  return error.type === "FieldMismatch" && typeof error.row === "number" ? error.row : undefined;
}

function hasStructuralParseError(error: ParseError): boolean {
  return error.type !== "FieldMismatch";
}

export function parseDeliveryCsv(csvText: string): CsvParseResult {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  const errors: string[] = [];
  const records: DeliveryPayload[] = [];
  const parserErrorRows = new Set<number>();

  parsed.errors.forEach((error) => {
    errors.push(formatPapaError(error));
    const errorRow = parseFieldMismatchRow(error);
    if (errorRow !== undefined) parserErrorRows.add(errorRow);
  });

  if (parsed.errors.some(hasStructuralParseError)) {
    return { records, errors };
  }

  parsed.data.forEach((row, index) => {
    if (parserErrorRows.has(index)) return;

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

    const rowErrors: string[] = [];
    const coverageStatus = parseEnumField(normalized.coverageStatus, "覆盖状态", COVERAGE_STATUSES, rowErrors);
    const projectStage = parseEnumField(normalized.projectStage, "项目阶段", PROJECT_STAGES, rowErrors);
    const provinceUniversityTotal = parseNumberField(normalized.provinceUniversityTotal, "省份高校总数", rowErrors);
    const cityUniversityTotal = parseNumberField(normalized.cityUniversityTotal, "城市高校总数", rowErrors);
    const resourceAmount = parseNumberField(normalized.resourceAmount, "资源数量", rowErrors);
    const extraJson = parseExtraJson(normalized.extraJson, rowErrors);

    if (rowErrors.length > 0) {
      errors.push(`第 ${line} 行字段错误：${rowErrors.join("；")}`);
      return;
    }

    records.push({
      province: normalized.province!.trim(),
      city: normalized.city!.trim(),
      university: normalized.university!.trim(),
      customerStatus: trimText(normalized.customerStatus),
      coverageStatus,
      projectStage,
      deliveryDate: trimText(normalized.deliveryDate),
      owner: trimText(normalized.owner),
      purchaseTags: splitTags(normalized.purchaseTags),
      productTags: splitTags(normalized.productTags),
      provinceUniversityTotal,
      cityUniversityTotal,
      resourceType: trimText(normalized.resourceType),
      resourceAmount,
      resourceUnit: trimText(normalized.resourceUnit),
      deliveryContent: trimText(normalized.deliveryContent),
      equipmentDetails: splitTags(normalized.equipmentDetails),
      painPoints: splitTags(normalized.painPoints),
      notes: trimText(normalized.notes),
      extraJson,
    });
  });

  return { records, errors };
}
