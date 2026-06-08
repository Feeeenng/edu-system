"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { filterDeliveries } from "@/lib/analytics/filter";
import { buildCoverageSummary, groupByProvince } from "@/lib/analytics/summary";
import { createClientProvider, shouldUseApiProvider } from "@/lib/data/client-provider";
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

async function fetchApiRecords() {
  const response = await fetch("/api/deliveries", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`交付数据读取失败：HTTP ${response.status}`);
  }

  const payload = (await response.json()) as { records?: DeliveryRecord[] };
  return Array.isArray(payload.records) ? payload.records : [];
}

export function useCoverageData(options: UseCoverageDataOptions = {}) {
  const initialRecords = options.initialRecords ?? EMPTY_RECORDS;
  const [records, setRecords] = useState<DeliveryRecord[]>(initialRecords);
  const [selectedProductTags, setSelectedProductTags] = useState<string[]>([]);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError(undefined);

    try {
      const nextRecords = options.initialRecords
        ? initialRecords
        : shouldUseApiProvider()
          ? await fetchApiRecords()
          : await createClientProvider().list();
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
      keyword,
    }),
    [keyword, selectedProductTags],
  );

  const filteredRecords = useMemo(() => filterDeliveries(records, filters), [filters, records]);
  const productOptions = useMemo(() => getProductOptions(records), [records]);
  const summary = useMemo(() => buildCoverageSummary(filteredRecords), [filteredRecords]);
  const provinceMetrics = useMemo(() => groupByProvince(filteredRecords), [filteredRecords]);

  return {
    records,
    filteredRecords,
    productOptions,
    selectedProductTags,
    setSelectedProductTags,
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
