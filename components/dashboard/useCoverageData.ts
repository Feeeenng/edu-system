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

  const filteredRecords = useMemo(() => filterDeliveries(records, filters), [filters, records]);
  const productOptions = useMemo(() => getProductOptions(records), [records]);
  const purchaseOptions = useMemo(() => getPurchaseOptions(records), [records]);
  const summary = useMemo(() => buildCoverageSummary(filteredRecords, records), [filteredRecords, records]);
  const provinceMetrics = useMemo(() => groupByProvince(filteredRecords, records), [filteredRecords, records]);

  return {
    records,
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
