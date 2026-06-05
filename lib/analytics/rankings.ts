import type { DeliveryRecord, RegionMetric } from "@/lib/types";

export function rankUniversities(records: DeliveryRecord[]): RegionMetric[] {
  const groups = new Map<string, DeliveryRecord[]>();
  for (const record of records) {
    const key = `${record.province}::${record.city}::${record.university}`;
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }

  return Array.from(groups.entries())
    .map(([key, group]) => {
      const [province, city, university] = key.split("::");
      return {
        name: university,
        province,
        city,
        universityCount: 1,
        deliveryCount: group.length,
        productTags: Array.from(new Set(group.flatMap((item) => item.productTags))).sort(),
        purchaseTags: Array.from(new Set(group.flatMap((item) => item.purchaseTags))).sort(),
      };
    })
    .sort((a, b) => b.deliveryCount - a.deliveryCount || a.name.localeCompare(b.name, "zh-CN"));
}
