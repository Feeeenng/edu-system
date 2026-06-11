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
  const filteredRecords = useMemo(
    () => filterDeliveries(records, filters),
    [filters, records],
  );
  const filteredRecordIds = useMemo(() => new Set(filteredRecords.map((record) => record.id)), [filteredRecords]);
  // 覆盖率统计分母始终使用全量后端数据；分子按产品标签、关键词等筛选条件计算。
  const coverageRecords = useMemo(
    () =>
      denominatorRecords.map((record) =>
        filteredRecordIds.has(record.id)
          ? record
          : { ...record, coverageStatus: undefined, productTags: [], purchaseTags: [] },
      ),
    [denominatorRecords, filteredRecordIds],
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
