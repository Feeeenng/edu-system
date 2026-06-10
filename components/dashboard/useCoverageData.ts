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
  const [selectedProductTags, setSelectedProductTags] = useState<string[]>([]);
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

  const denominatorRecords = records;
  const coverageRecords = useMemo(
    () =>
      denominatorRecords.map((record) =>
        matchesSelectedCoverage(record, selectedProductTags, selectedPurchaseTags)
          ? record
          : { ...record, coverageStatus: undefined, productTags: [], purchaseTags: [] },
      ),
    [denominatorRecords, selectedProductTags, selectedPurchaseTags],
  );
  // 覆盖率统计不能被关键词搜索缩小分母；搜索只用于右侧高校明细列表。
  const filteredRecords = useMemo(
    () => filterDeliveries(records, filters),
    [filters, records],
  );
  const productOptions = useMemo(() => getProductOptions(records), [records]);
  const purchaseOptions = useMemo(() => getPurchaseOptions(records), [records]);
  const summary = useMemo(() => buildCoverageSummary(coverageRecords, denominatorRecords), [coverageRecords, denominatorRecords]);
  const provinceMetrics = useMemo(
    () => groupByProvince(coverageRecords, denominatorRecords),
    [coverageRecords, denominatorRecords],
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
