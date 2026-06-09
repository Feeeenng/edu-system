import type { CoverageSummary, DeliveryRecord, RegionMetric, UniversityDetail } from "@/lib/types";
import { isCoveredValue } from "@/lib/coverage/status";
import { NATIONAL_UNIVERSITY_TOTAL, REGION_BASELINES } from "@/lib/data/region-baseline";

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function compareByDeliveryCountThenName(a: RegionMetric, b: RegionMetric) {
  return b.deliveryCount - a.deliveryCount || a.name.localeCompare(b.name, "zh-CN");
}

function schoolKey(record: DeliveryRecord) {
  return record.schoolId?.trim() || `${record.province}::${record.city}::${record.university}`;
}

function isCoveredRecord(record: DeliveryRecord) {
  // 产品/采购标签表示该学校已有业务覆盖；同一学校多条记录只计 1 次。
  return (
    record.productTags.length > 0 ||
    record.purchaseTags.length > 0 ||
    isCoveredValue([
      record.customerStatus,
      record.coverageStatus,
      record.projectStage,
      record.deliveryContent,
      record.notes,
      record.extraJson,
    ])
  );
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

function getBaselineMetricMap() {
  return new Map(REGION_BASELINES.map((item) => [item.province, item]));
}

function shouldUseSddcBaseline(records: DeliveryRecord[]) {
  return records.length === 0 || records.every((record) => record.productTags.length === 0 || record.productTags.includes("SDDC"));
}

function buildRegionMetric(
  name: string,
  records: DeliveryRecord[],
  denominatorRecords: DeliveryRecord[],
  province?: string,
  city?: string,
): RegionMetric {
  const baseline = province && !city && shouldUseSddcBaseline(records) ? getBaselineMetricMap().get(province) : undefined;
  const universityCount = baseline ? baseline.sddcDeployed : countCoveredSchools(records);
  const totalUniversityCount = baseline ? baseline.total : countUniqueSchools(denominatorRecords);

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
  const useSddcBaseline = shouldUseSddcBaseline(records);
  const universityCount = useSddcBaseline
    ? REGION_BASELINES.reduce((sum, item) => sum + item.sddcDeployed, 0)
    : countCoveredSchools(records);
  const totalUniversityCount = useSddcBaseline ? NATIONAL_UNIVERSITY_TOTAL : countUniqueSchools(denominatorRecords);

  return {
    provinceCount: useSddcBaseline ? REGION_BASELINES.length : new Set(records.map((item) => item.province)).size,
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
  if (shouldUseSddcBaseline(records)) {
    return REGION_BASELINES.map((baseline) => ({
      name: baseline.province,
      province: baseline.province,
      universityCount: baseline.sddcDeployed,
      totalUniversityCount: baseline.total,
      coverageRate: baseline.total > 0 ? baseline.sddcDeployed / baseline.total : undefined,
      deliveryCount: baseline.sddcDeployed,
      productTags: baseline.sddcDeployed > 0 ? ["SDDC"] : [],
      purchaseTags: [],
    })).sort(compareByDeliveryCountThenName);
  }

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
