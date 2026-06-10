import { normalizeDeliveryPayload } from "@/lib/data/normalize";
import type { DeliveryPayload, DeliveryRecord } from "@/lib/types";

type DeliveryLike = DeliveryPayload | DeliveryRecord;

function normalizeText(value: string | undefined) {
  return value?.trim() ?? "";
}

function normalizeList(value: string[] | undefined) {
  return Array.from(new Set((value ?? []).map((item) => item.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "zh-CN"),
  );
}

function normalizeExtraJson(value: Record<string, unknown> | undefined) {
  if (!value) return "";
  return JSON.stringify(
    Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = value[key];
        return result;
      }, {}),
  );
}

export function getDeliveryBusinessKey(delivery: DeliveryLike) {
  const normalized = normalizeDeliveryPayload(delivery);
  // 去重只看业务内容，忽略 id / updatedAt，避免重复导入同一 CSV 时生成重复案例。
  return JSON.stringify({
    schoolId: normalizeText(normalized.schoolId),
    province: normalizeText(normalized.province),
    city: normalizeText(normalized.city),
    university: normalizeText(normalized.university),
    customerStatus: normalizeText(normalized.customerStatus),
    coverageStatus: normalizeText(normalized.coverageStatus),
    projectStage: normalizeText(normalized.projectStage),
    deliveryDate: normalizeText(normalized.deliveryDate),
    owner: normalizeText(normalized.owner),
    purchaseYear: normalizeText(normalized.purchaseYear),
    purchaseTags: normalizeList(normalized.purchaseTags),
    productTags: normalizeList(normalized.productTags),
    resourceType: normalizeText(normalized.resourceType),
    resourceAmount: normalized.resourceAmount ?? "",
    resourceUnit: normalizeText(normalized.resourceUnit),
    businessScenario: normalizeText(normalized.businessScenario),
    coreValue: normalizeText(normalized.coreValue),
    deviceModel: normalizeText(normalized.deviceModel),
    bidLink: normalizeText(normalized.bidLink),
    deliveryContent: normalizeText(normalized.deliveryContent),
    equipmentDetails: normalizeList(normalized.equipmentDetails),
    painPoints: normalizeList(normalized.painPoints),
    notes: normalizeText(normalized.notes),
    extraJson: normalizeExtraJson(normalized.extraJson),
  });
}

export function dedupeDeliveries<T extends DeliveryLike>(deliveries: T[]) {
  const seen = new Set<string>();
  const deduped: T[] = [];

  for (const delivery of deliveries) {
    const key = getDeliveryBusinessKey(delivery);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(delivery);
  }

  return deduped;
}
