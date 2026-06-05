import type { CoverageSummary, DeliveryRecord, RegionMetric, UniversityDetail } from "@/lib/types";

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function compareByDeliveryCountThenName(a: RegionMetric, b: RegionMetric) {
  return b.deliveryCount - a.deliveryCount || a.name.localeCompare(b.name, "zh-CN");
}

function universityKey(record: DeliveryRecord) {
  return `${record.province}::${record.city}::${record.university}`;
}

function buildRegionMetric(name: string, records: DeliveryRecord[], province?: string, city?: string): RegionMetric {
  return {
    name,
    province,
    city,
    universityCount: new Set(records.map(universityKey)).size,
    deliveryCount: records.length,
    productTags: unique(records.flatMap((item) => item.productTags)),
    purchaseTags: unique(records.flatMap((item) => item.purchaseTags)),
  };
}

export function buildCoverageSummary(records: DeliveryRecord[]): CoverageSummary {
  return {
    provinceCount: new Set(records.map((item) => item.province)).size,
    cityCount: new Set(records.map((item) => `${item.province}::${item.city}`)).size,
    universityCount: new Set(records.map(universityKey)).size,
    deliveryCount: records.length,
    productCount: new Set(records.flatMap((item) => item.productTags).filter(Boolean)).size,
    purchaseTagCount: new Set(records.flatMap((item) => item.purchaseTags).filter(Boolean)).size,
  };
}

export function groupByProvince(records: DeliveryRecord[]): RegionMetric[] {
  const groups = new Map<string, DeliveryRecord[]>();
  for (const record of records) {
    const group = groups.get(record.province);
    if (group) {
      group.push(record);
    } else {
      groups.set(record.province, [record]);
    }
  }

  return Array.from(groups.entries())
    .map(([province, group]) => buildRegionMetric(province, group, province))
    .sort(compareByDeliveryCountThenName);
}

export function groupByCity(records: DeliveryRecord[], province: string): RegionMetric[] {
  const groups = new Map<string, DeliveryRecord[]>();
  for (const record of records.filter((item) => item.province === province)) {
    const group = groups.get(record.city);
    if (group) {
      group.push(record);
    } else {
      groups.set(record.city, [record]);
    }
  }

  return Array.from(groups.entries())
    .map(([city, group]) => buildRegionMetric(city, group, province, city))
    .sort(compareByDeliveryCountThenName);
}

export function getUniversityDetail(
  records: DeliveryRecord[],
  province: string,
  city: string,
  university: string,
): UniversityDetail | undefined {
  const deliveries = records
    .filter((item) => item.province === province && item.city === city && item.university === university)
    .sort((a, b) => (b.deliveryDate ?? "").localeCompare(a.deliveryDate ?? ""));

  if (deliveries.length === 0) return undefined;

  return {
    province,
    city,
    university,
    deliveries,
    productTags: unique(deliveries.flatMap((item) => item.productTags)),
    purchaseTags: unique(deliveries.flatMap((item) => item.purchaseTags)),
    latestDeliveryDate: deliveries[0]?.deliveryDate,
  };
}
