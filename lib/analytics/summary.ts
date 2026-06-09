import type { CoverageSummary, DeliveryRecord, RegionMetric, UniversityDetail } from "@/lib/types";

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function compareByDeliveryCountThenName(a: RegionMetric, b: RegionMetric) {
  return b.deliveryCount - a.deliveryCount || a.name.localeCompare(b.name, "zh-CN");
}

const COVERAGE_SIGNALS = ["已下单", "新增商机"] as const;

function valueHasCoverageSignal(value: unknown): boolean {
  if (typeof value === "string") return COVERAGE_SIGNALS.some((signal) => value.includes(signal));
  if (Array.isArray(value)) return value.some(valueHasCoverageSignal);
  if (typeof value === "object" && value !== null) return Object.values(value).some(valueHasCoverageSignal);
  return false;
}

function isCoveredRecord(record: DeliveryRecord) {
  // 同一条记录同时出现“已下单”和“新增商机”时，按一条覆盖记录计数。
  return valueHasCoverageSignal([
    record.customerStatus,
    record.coverageStatus,
    record.projectStage,
    record.purchaseTags,
    record.productTags,
    record.deliveryContent,
    record.notes,
    record.extraJson,
  ]);
}

function buildRegionMetric(
  name: string,
  records: DeliveryRecord[],
  denominatorRecords: DeliveryRecord[],
  province?: string,
  city?: string,
): RegionMetric {
  const universityCount = records.filter(isCoveredRecord).length;
  const totalUniversityCount = denominatorRecords.length;

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
  const universityCount = records.filter(isCoveredRecord).length;
  const totalUniversityCount = denominatorRecords.length;

  return {
    provinceCount: new Set(records.map((item) => item.province)).size,
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

export function groupByCity(
  records: DeliveryRecord[],
  province: string,
  denominatorRecords: DeliveryRecord[] = records,
): RegionMetric[] {
  const scopedRecords = records.filter((item) => item.province === province);
  const scopedDenominatorRecords = denominatorRecords.filter((item) => item.province === province);
  const groups = groupRecordsBy(scopedRecords, (record) => record.city);
  const denominatorGroups = groupRecordsBy(scopedDenominatorRecords, (record) => record.city);
  const cities = Array.from(new Set([...groups.keys(), ...denominatorGroups.keys()]));

  return cities
    .map((city) => buildRegionMetric(city, groups.get(city) ?? [], denominatorGroups.get(city) ?? [], province, city))
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
