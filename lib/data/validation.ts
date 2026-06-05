import type { DeliveryPayload } from "@/lib/types";

type ValidationResult = { ok: true } | { ok: false; error: string };

const REQUIRED_FIELDS: Array<[keyof DeliveryPayload, string]> = [
  ["province", "省份"],
  ["city", "地区/城市"],
  ["university", "高校名称"],
];

const TAG_FIELDS: Array<[keyof DeliveryPayload, string]> = [
  ["purchaseTags", "采购标签"],
  ["productTags", "产品标签"],
];

const NUMBER_FIELDS: Array<[keyof DeliveryPayload, string]> = [
  ["longitude", "经度"],
  ["latitude", "纬度"],
  ["resourceAmount", "资源数量"],
];

function hasText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateStringArray(value: unknown) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function validateDeliveryPayload(payload: unknown): ValidationResult {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "交付记录必须是对象" };
  }

  const record = payload as Partial<DeliveryPayload>;
  const missing = REQUIRED_FIELDS.filter(([key]) => !hasText(record[key])).map(([, label]) => label);
  if (missing.length > 0) {
    return { ok: false, error: `缺少必填字段：${missing.join("、")}` };
  }

  for (const [key, label] of TAG_FIELDS) {
    const value = record[key];
    if (value !== undefined && !validateStringArray(value)) {
      return { ok: false, error: `${label}必须是字符串数组` };
    }
  }

  for (const [key, label] of NUMBER_FIELDS) {
    const value = record[key];
    if (value !== undefined && (typeof value !== "number" || !Number.isFinite(value))) {
      return { ok: false, error: `${label}必须是有效数字` };
    }
  }

  return { ok: true };
}

export function validateDeliveryPayloadArray(payloads: unknown): ValidationResult {
  if (!Array.isArray(payloads)) {
    return { ok: false, error: "交付记录必须是数组" };
  }

  if (payloads.length === 0) {
    return { ok: false, error: "交付记录不能为空" };
  }

  for (let index = 0; index < payloads.length; index += 1) {
    const result = validateDeliveryPayload(payloads[index]);
    if (!result.ok) {
      return { ok: false, error: `第 ${index + 1} 条记录${result.error}` };
    }
  }

  return { ok: true };
}
