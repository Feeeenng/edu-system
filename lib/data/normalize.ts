import type { DeliveryPayload, DeliveryRecord } from "@/lib/types";

function cleanText(value: string | undefined) {
  return value?.trim() ?? "";
}

function cleanOptionalText(value: string | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

function cleanTags(value: string[] | undefined) {
  return Array.from(new Set((value ?? []).map((item) => item.trim()).filter(Boolean)));
}

function cleanNumber(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function normalizeDeliveryPayload(payload: DeliveryPayload): DeliveryPayload {
  return {
    ...payload,
    province: cleanText(payload.province),
    city: cleanText(payload.city),
    university: cleanText(payload.university),
    longitude: cleanNumber(payload.longitude),
    latitude: cleanNumber(payload.latitude),
    customerStatus: cleanOptionalText(payload.customerStatus),
    coverageStatus: cleanOptionalText(payload.coverageStatus) as DeliveryPayload["coverageStatus"],
    projectStage: cleanOptionalText(payload.projectStage) as DeliveryPayload["projectStage"],
    deliveryDate: cleanOptionalText(payload.deliveryDate),
    owner: cleanOptionalText(payload.owner),
    purchaseTags: cleanTags(payload.purchaseTags),
    productTags: cleanTags(payload.productTags),
    resourceType: cleanOptionalText(payload.resourceType),
    resourceAmount: cleanNumber(payload.resourceAmount),
    resourceUnit: cleanOptionalText(payload.resourceUnit),
    deliveryContent: cleanOptionalText(payload.deliveryContent),
    notes: cleanOptionalText(payload.notes),
    extraJson: payload.extraJson,
  };
}

export function createDeliveryRecord(payload: DeliveryPayload): DeliveryRecord {
  const normalized = normalizeDeliveryPayload(payload);
  return {
    ...normalized,
    id: normalized.id ?? `delivery-${crypto.randomUUID()}`,
    updatedAt: cleanOptionalText(normalized.updatedAt) ?? new Date().toISOString(),
  };
}
