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

function validTotal(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function getMaxTotal(records: DeliveryRecord[], key: "provinceUniversityTotal" | "cityUniversityTotal") {
  const totals = records.map((record) => validTotal(record[key])).filter((value): value is number => value !== undefined);
  return totals.length > 0 ? Math.max(...totals) : undefined;
}

function normalizeTotal(total: number | undefined, covered: number) {
  if (total === undefined) return undefined;
  return Math.max(total, covered);
}

function buildRegionMetric(
  name: string,
  records: DeliveryRecord[],
  denominatorRecords: DeliveryRecord[],
  province?: string,
  city?: string,
): RegionMetric {
  const universityCount = new Set(records.map(universityKey)).size;
  const rawTotal = city
    ? getMaxTotal(denominatorRecords, "cityUniversityTotal")
    : getMaxTotal(denominatorRecords, "provinceUniversityTotal");
  const totalUniversityCount = normalizeTotal(rawTotal, universityCount);

  return {
    name,
    province,
    city,
    universityCount,
    totalUniversityCount,
    coverageRate: totalUniversityCount ? universityCount / totalUniversityCount : undefined,
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

function getCountryTotalUniversityCount(records: DeliveryRecord[]) {
  const provinceGroups = groupRecordsBy(records, (record) => record.province);
  const provinceTotals = Array.from(provinceGroups.values())
    .map((group) => getMaxTotal(group, "provinceUniversityTotal"))
    .filter((value): value is number => value !== undefined);

  if (provinceTotals.length > 0) return provinceTotals.reduce((sum, value) => sum + value, 0);

  const cityGroups = groupRecordsBy(records, (record) => `${record.province}::${record.city}`);
  const cityTotals = Array.from(cityGroups.values())
    .map((group) => getMaxTotal(group, "cityUniversityTotal"))
    .filter((value): value is number => value !== undefined);

  return cityTotals.length > 0 ? cityTotals.reduce((sum, value) => sum + value, 0) : undefined;
}

export function buildCoverageSummary(records: DeliveryRecord[], denominatorRecords: DeliveryRecord[] = records): CoverageSummary {
  const universityCount = new Set(records.map(universityKey)).size;
  const totalUniversityCount = normalizeTotal(getCountryTotalUniversityCount(denominatorRecords), universityCount);

  return {
    provinceCount: new Set(records.map((item) => item.province)).size,
    cityCount: new Set(records.map((item) => `${item.province}::${item.city}`)).size,
    universityCount,
    deliveryCount: records.length,
    productCount: new Set(records.flatMap((item) => item.productTags).filter(Boolean)).size,
    purchaseTagCount: new Set(records.flatMap((item) => item.purchaseTags).filter(Boolean)).size,
    totalUniversityCount,
    coverageRate: totalUniversityCount ? universityCount / totalUniversityCount : undefined,
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
