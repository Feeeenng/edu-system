import type { CoverageSummary, DeliveryRecord, RegionMetric, UniversityDetail } from "@/lib/types";

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function compareByDeliveryCountThenName(a: RegionMetric, b: RegionMetric) {
  return b.deliveryCount - a.deliveryCount || a.name.localeCompare(b.name, "zh-CN");
}

function schoolKey(record: DeliveryRecord) {
  return record.university.replace(/[\s\u200b-\u200f\ufeff]/g, "").toLocaleLowerCase("zh-CN");
}

function isCoveredRecord(record: DeliveryRecord) {
  // 首页覆盖口径只统计已部署学校，标签和客户现状仅用于筛选与展示，不再直接计入覆盖数。
  return record.coverageStatus === "已部署";
}

function countUniqueSchools(records: DeliveryRecord[]) {
  return new Set(records.map(schoolKey)).size;
}

function countCoveredSchools(records: DeliveryRecord[]) {
  const coveredSchools = new Set<string>();
  for (const record of records) {
    if (isCoveredRecord(record)) coveredSchools.add(schoolKey(record));
  }
  return coveredSchools.size;
}

function buildRegionMetric(
  name: string,
  records: DeliveryRecord[],
  denominatorRecords: DeliveryRecord[],
  province?: string,
  city?: string,
): RegionMetric {
  const universityCount = countCoveredSchools(records);
  const totalUniversityCount = countUniqueSchools(denominatorRecords);

  return {
    name,
    province,
    city,
    universityCount,
    totalUniversityCount,
    coverageRate: totalUniversityCount > 0 ? universityCount / totalUniversityCount : undefined,
    deliveryCount: records.length,
    productTags: unique(records.flatMap((item) => item.productTags)),
    purchaseTags: unique(records.flatMap((item) => item.purchaseTags)),
  };
}

function groupRecordsBy(records: DeliveryRecord[], getKey: (record: DeliveryRecord) => string) {
  const groups = new Map<string, DeliveryRecord[]>();
  for (const record of records) {
    const key = getKey(record);
    const group = groups.get(key);
    if (group) {
      group.push(record);
    } else {
      groups.set(key, [record]);
    }
  }
  return groups;
}

export function buildCoverageSummary(records: DeliveryRecord[], denominatorRecords: DeliveryRecord[] = records): CoverageSummary {
  const universityCount = countCoveredSchools(records);
  const totalUniversityCount = countUniqueSchools(denominatorRecords);

  return {
    provinceCount: new Set(denominatorRecords.map((item) => item.province)).size,
    cityCount: new Set(records.map((item) => `${item.province}::${item.city}`)).size,
    universityCount,
    deliveryCount: records.length,
    productCount: new Set(records.flatMap((item) => item.productTags).filter(Boolean)).size,
    purchaseTagCount: new Set(records.flatMap((item) => item.purchaseTags).filter(Boolean)).size,
    totalUniversityCount,
    coverageRate: totalUniversityCount > 0 ? universityCount / totalUniversityCount : undefined,
  };
}

export function groupByProvince(records: DeliveryRecord[], denominatorRecords: DeliveryRecord[] = records): RegionMetric[] {
  const groups = groupRecordsBy(records, (record) => record.province);
  const denominatorGroups = groupRecordsBy(denominatorRecords, (record) => record.province);
  const provinces = Array.from(new Set([...groups.keys(), ...denominatorGroups.keys()]));

  return provinces
    .map((province) => buildRegionMetric(province, groups.get(province) ?? [], denominatorGroups.get(province) ?? [], province))
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
