import type { DeliveryFilters, DeliveryRecord } from "@/lib/types";

function includesEvery(selected: string[] | undefined, values: string[]) {
  if (!selected || selected.length === 0) return true;
  return selected.every((tag) => values.includes(tag));
}

export function filterDeliveries(records: DeliveryRecord[], filters: DeliveryFilters): DeliveryRecord[] {
  const keyword = filters.keyword?.trim().toLowerCase();

  return records.filter((record) => {
    if (filters.province && record.province !== filters.province) return false;
    if (filters.city && record.city !== filters.city) return false;
    if (filters.university && record.university !== filters.university) return false;
    if (filters.coverageStatus && record.coverageStatus !== filters.coverageStatus) return false;
    if (filters.projectStage && record.projectStage !== filters.projectStage) return false;
    if (!includesEvery(filters.purchaseTags, record.purchaseTags)) return false;
    if (!includesEvery(filters.productTags, record.productTags)) return false;

    if (keyword) {
      const haystack = [
        record.province,
        record.city,
        record.university,
        record.owner,
        record.deliveryContent,
        record.notes,
        record.resourceType,
        ...record.purchaseTags,
        ...record.productTags,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(keyword)) return false;
    }

    return true;
  });
}
