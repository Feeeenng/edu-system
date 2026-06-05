import type { DeliveryRecord, RegionMetric } from "@/lib/types";

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function compareRanking(a: RegionMetric, b: RegionMetric) {
  return (
    b.deliveryCount - a.deliveryCount ||
    a.name.localeCompare(b.name, "zh-CN") ||
    (a.province ?? "").localeCompare(b.province ?? "", "zh-CN") ||
    (a.city ?? "").localeCompare(b.city ?? "", "zh-CN")
  );
}

export function rankUniversities(records: DeliveryRecord[]): RegionMetric[] {
  const groups = new Map<string, DeliveryRecord[]>();
  for (const record of records) {
    const key = `${record.province}::${record.city}::${record.university}`;
    const group = groups.get(key);
    if (group) {
      group.push(record);
    } else {
      groups.set(key, [record]);
    }
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
        productTags: unique(group.flatMap((item) => item.productTags)),
        purchaseTags: unique(group.flatMap((item) => item.purchaseTags)),
      };
    })
    .sort(compareRanking);
}
