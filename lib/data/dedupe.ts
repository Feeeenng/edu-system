import { normalizeDeliveryPayload } from "@/lib/data/normalize";
import type { DeliveryPayload, DeliveryRecord } from "@/lib/types";

type DeliveryLike = DeliveryPayload | DeliveryRecord;

function normalizeUniversityKey(value: string | undefined) {
  return (value ?? "").replace(/[\s\u200b-\u200f\ufeff]/g, "").toLocaleLowerCase("zh-CN");
}

export function getDeliveryBusinessKey(delivery: DeliveryLike) {
  const normalized = normalizeDeliveryPayload(delivery);
  // 当前业务以“高校名称”为唯一维护对象；重复导入同一学校时保留列表中靠前的记录。
  return normalizeUniversityKey(normalized.university);
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
