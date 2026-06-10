import * as XLSX from "xlsx";
import { normalizeCoverageStatus } from "@/lib/coverage/status";
import { EXCEL_COLUMNS, EXCEL_SHEET_NAME, resolveExcelColumnKey } from "@/lib/excel/schema";
import type { DeliveryPayload, DeliveryRecord } from "@/lib/types";

export type ExcelParseResult = {
  records: DeliveryPayload[];
  errors: string[];
};

const TEMPLATE_SAMPLE: DeliveryPayload = {
  schoolId: "1",
  province: "北京市",
  city: "北京市",
  university: "北京大学",
  coverageStatus: "已部署",
  customerStatus: "信息中心华为超融合+少部份VMware",
  purchaseYear: "2025年",
  purchaseTags: ["会议中心"],
  productTags: ["SDDC"],
  resourceType: "SDDC",
  resourceAmount: 4,
  resourceUnit: "C",
  businessScenario: "会议中心系统",
  coreValue: "暂无",
  deviceModel: "纯软件交付",
  bidLink: "无",
  notes: "可按模板继续维护",
};

function splitList(value: unknown): string[] {
  if (typeof value !== "string" && typeof value !== "number") return [];
  return String(value)
    .split(/[;；/、,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function trimText(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function parseNumberField(value: unknown, label: string, errors: string[]) {
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
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) return parsed;
  } catch {
    // 统一返回字段级错误，避免非法 JSON 静默丢弃。
  }

  errors.push("扩展字段JSON必须是合法 JSON 对象");
  return undefined;
}

function normalizeResourceProduct(resourceType: string | undefined) {
  if (!resourceType) return [];
  const normalized = resourceType.replace(/adesk/gi, "桌面云").replace(/AIBuilder/gi, "FastGPT");
  return splitList(normalized);
}

function formatCoverageStatusForExcel(value: DeliveryPayload["coverageStatus"]) {
  if (value === "已部署" || value === "已覆盖" || value === "已下单" || value === "已下单+新增商机") {
    return "✅ 已部署";
  }
  if (value === "新增商机" || value === "跟进中") return "🟡 跟进中";
  if (value === "未覆盖") return "➖ 未覆盖";
  return value ?? "";
}

function formatValue(record: DeliveryPayload | DeliveryRecord, key: keyof DeliveryPayload) {
  if (key === "coverageStatus") return formatCoverageStatusForExcel(record.coverageStatus);
  if (key === "extraJson" && record.extraJson && typeof record.extraJson === "object") return JSON.stringify(record.extraJson);
  if (key === "purchaseTags") return (record.purchaseTags ?? []).join(";");
  if (Array.isArray(record[key])) return record[key]?.join(";");
  return record[key] ?? "";
}

function rowsToSheet(rows: unknown[][]) {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = EXCEL_COLUMNS.map((column) => ({ wch: column.width }));
  return worksheet;
}

export function buildExcelTemplate() {
  return buildDeliveriesWorkbook([TEMPLATE_SAMPLE]);
}

export function buildDeliveriesWorkbook(records: Array<DeliveryPayload | DeliveryRecord>) {
  const rows = [
    EXCEL_COLUMNS.map((column) => column.label),
    ...records.map((record) => EXCEL_COLUMNS.map((column) => formatValue(record, column.key))),
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, rowsToSheet(rows), EXCEL_SHEET_NAME);
  return XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}

export async function parseDeliveryExcel(file: File): Promise<ExcelParseResult> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) return { records: [], errors: ["Excel 中没有可读取的工作表"] };

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" });
  const errors: string[] = [];
  const records: DeliveryPayload[] = [];

  rows.forEach((row, index) => {
    const line = index + 2;
    const normalized: Partial<Record<keyof DeliveryPayload, unknown>> = {};

    for (const [header, value] of Object.entries(row)) {
      const key = resolveExcelColumnKey(header);
      if (key) normalized[key] = value;
    }

    const missing = [
      ["province", "省份"],
      ["university", "高校名称"],
    ].filter(([key]) => !trimText(normalized[key as keyof DeliveryPayload]));

    if (missing.length > 0) {
      errors.push(`第 ${line} 行缺少必填字段：${missing.map((item) => item[1]).join("、")}`);
      return;
    }

    const rowErrors: string[] = [];
    const resourceType = trimText(normalized.resourceType);
    const resourceProducts = normalizeResourceProduct(resourceType);
    const purchaseTags = splitList(normalized.purchaseTags);
    const resourceAmount = parseNumberField(normalized.resourceAmount, "资源规模", rowErrors);
    const extraJson = parseExtraJson(normalized.extraJson, rowErrors);

    if (rowErrors.length > 0) {
      errors.push(`第 ${line} 行字段错误：${rowErrors.join("；")}`);
      return;
    }

    records.push({
      schoolId: trimText(normalized.schoolId),
      province: trimText(normalized.province)!,
      city: trimText(normalized.city) ?? trimText(normalized.province)!,
      university: trimText(normalized.university)!,
      coverageStatus: normalizeCoverageStatus(normalized.coverageStatus),
      customerStatus: trimText(normalized.customerStatus),
      purchaseYear: trimText(normalized.purchaseYear),
      purchaseTags,
      productTags: resourceProducts,
      resourceType,
      resourceAmount,
      resourceUnit: trimText(normalized.resourceUnit),
      businessScenario: trimText(normalized.businessScenario),
      coreValue: trimText(normalized.coreValue),
      deviceModel: trimText(normalized.deviceModel),
      bidLink: trimText(normalized.bidLink),
      deliveryContent: [trimText(normalized.businessScenario), trimText(normalized.coreValue)].filter(Boolean).join("；") || undefined,
      equipmentDetails: splitList(normalized.deviceModel),
      painPoints: splitList(normalized.coreValue),
      notes: trimText(normalized.notes),
      extraJson,
    });
  });

  return { records, errors };
}
