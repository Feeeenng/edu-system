"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { filterDeliveries } from "@/lib/analytics/filter";
import { buildCoverageSummary, groupByProvince } from "@/lib/analytics/summary";
import { createClientProvider } from "@/lib/data/client-provider";
import type { DeliveryFilters, DeliveryRecord } from "@/lib/types";

type UseCoverageDataOptions = {
  initialRecords?: DeliveryRecord[];
};

const EMPTY_RECORDS: DeliveryRecord[] = [];

function getProductOptions(records: DeliveryRecord[]) {
  return Array.from(new Set(records.flatMap((record) => record.productTags).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "zh-CN"),
  );
}

function getPurchaseOptions(records: DeliveryRecord[]) {
  return Array.from(new Set(records.flatMap((record) => record.purchaseTags).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "zh-CN"),
  );
}

function hasEveryTag(selected: string[], tags: string[]) {
  return selected.length === 0 || selected.every((tag) => tags.includes(tag));
}

function matchesSelectedCoverage(record: DeliveryRecord, productTags: string[], purchaseTags: string[]) {
  return hasEveryTag(productTags, record.productTags) && hasEveryTag(purchaseTags, record.purchaseTags);
}

export function useCoverageData(options: UseCoverageDataOptions = {}) {
  const initialRecords = options.initialRecords ?? EMPTY_RECORDS;
  const [records, setRecords] = useState<DeliveryRecord[]>(initialRecords);
  const [selectedProductTags, setSelectedProductTags] = useState<string[]>(["SDDC"]);
  const [selectedPurchaseTags, setSelectedPurchaseTags] = useState<string[]>([]);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError(undefined);

    try {
      const nextRecords = options.initialRecords ? initialRecords : await createClientProvider().list();
      setRecords(nextRecords);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "交付数据读取失败");
      setRecords(initialRecords);
    } finally {
      setLoading(false);
    }
  }, [initialRecords, options.initialRecords]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const filters: DeliveryFilters = useMemo(
    () => ({
      productTags: selectedProductTags,
      purchaseTags: selectedPurchaseTags,
      keyword,
    }),
    [keyword, selectedProductTags, selectedPurchaseTags],
  );

  const denominatorRecords = useMemo(
    () => filterDeliveries(records, { keyword }),
    [keyword, records],
  );
  const filteredRecords = useMemo(
    () =>
      denominatorRecords.map((record) =>
        matchesSelectedCoverage(record, selectedProductTags, selectedPurchaseTags)
          ? record
          : { ...record, coverageStatus: undefined, productTags: [], purchaseTags: [] },
      ),
    [denominatorRecords, selectedProductTags, selectedPurchaseTags],
  );
  const productOptions = useMemo(() => getProductOptions(records), [records]);
  const purchaseOptions = useMemo(() => getPurchaseOptions(records), [records]);
  const summary = useMemo(() => buildCoverageSummary(filteredRecords, denominatorRecords), [denominatorRecords, filteredRecords]);
  const provinceMetrics = useMemo(
    () => groupByProvince(filteredRecords, denominatorRecords),
    [denominatorRecords, filteredRecords],
  );

  return {
    records,
    denominatorRecords,
    filteredRecords,
    productOptions,
    purchaseOptions,
    selectedProductTags,
    setSelectedProductTags,
    selectedPurchaseTags,
    setSelectedPurchaseTags,
    keyword,
    setKeyword,
    filters,
    summary,
    provinceMetrics,
    loading,
    error,
    refresh: loadRecords,
  };
}
