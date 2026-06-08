"use client";

import {
  ArrowLeft,
  ArrowUpDown,
  Boxes,
  Database,
  FileUp,
  GraduationCap,
  Lightbulb,
  MapPinned,
  Search,
  ServerCog,
  Target,
  TrendingUp,
} from "lucide-react";
import { gsap } from "gsap";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { getUniversityDetail, groupByCity } from "@/lib/analytics/summary";
import { ChinaCoverageMap } from "@/components/dashboard/ChinaCoverageMap";
import { useCoverageData } from "@/components/dashboard/useCoverageData";
import { parseDeliveryCsv } from "@/lib/csv/parse";
import { createClientProvider } from "@/lib/data/client-provider";
import { dedupeDeliveries } from "@/lib/data/dedupe";
import { createDeliveryRecord } from "@/lib/data/normalize";
import type { DeliveryRecord, RegionMetric, UniversityDetail } from "@/lib/types";
import "./coverage-dashboard.css";

const PRODUCT_ORDER = ["SDDC", "EDS", "桌面云", "FastGPT"];
const PURCHASE_ORDER = ["VMware替换", "信创", "AI超融合"];

type CoverageDashboardProps = {
  initialRecords?: DeliveryRecord[];
};

type CoverageSortKey = "coverageRate" | "universityCount" | "totalUniversityCount";
type CoverageSortDirection = "asc" | "desc";

function formatTags(tags: string[]) {
  return tags.length > 0 ? tags.join(" / ") : "暂无标签";
}

function getUniqueItems(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function isUniversityDetail(value: UniversityDetail | undefined): value is UniversityDetail {
  return value !== undefined;
}

function prefersReducedMotion() {
  if (process.env.NODE_ENV === "test") return true;
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function getMetricMap(metrics: RegionMetric[]) {
  return new Map(metrics.map((metric) => [metric.name, metric]));
}

function formatCoverageFraction(covered: number, total?: number) {
  return total ? `${covered} / ${total}` : `${covered} / -`;
}

function formatPercent(value?: number) {
  return value !== undefined ? `${Math.round(value * 1000) / 10}%` : "-";
}

function getCoverageSortValue(metric: RegionMetric) {
  return metric.coverageRate ?? -1;
}

function compareHigherCoverage(a: RegionMetric, b: RegionMetric) {
  return (
    getCoverageSortValue(b) - getCoverageSortValue(a) ||
    b.universityCount - a.universityCount ||
    a.name.localeCompare(b.name, "zh-CN")
  );
}

function compareLowerCoverage(a: RegionMetric, b: RegionMetric) {
  return (
    getCoverageSortValue(a) - getCoverageSortValue(b) ||
    a.universityCount - b.universityCount ||
    a.name.localeCompare(b.name, "zh-CN")
  );
}

function getRankableMetrics(metrics: RegionMetric[]) {
  return metrics.filter((metric) => metric.totalUniversityCount !== undefined);
}

function getSortValue(metric: RegionMetric, sortKey: CoverageSortKey) {
  if (sortKey === "coverageRate") return metric.coverageRate;
  return metric[sortKey];
}

function sortCoverageMetrics(metrics: RegionMetric[], sortKey: CoverageSortKey, sortDirection: CoverageSortDirection) {
  return [...metrics].sort((a, b) => {
    const direction = sortDirection === "desc" ? -1 : 1;
    const aValue = getSortValue(a, sortKey);
    const bValue = getSortValue(b, sortKey);
    if (aValue === undefined && bValue === undefined) return compareHigherCoverage(a, b);
    if (aValue === undefined) return 1;
    if (bValue === undefined) return -1;
    const valueDiff = aValue - bValue;
    return valueDiff * direction || compareHigherCoverage(a, b);
  });
}

function getUniversityCards(records: DeliveryRecord[]) {
  const seen = new Set<string>();
  return records
    .filter((record) => {
      // 同一高校可能有多次交付，首页明细按高校聚合展示。
      const key = `${record.province}/${record.city}/${record.university}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((record) => getUniversityDetail(records, record.province, record.city, record.university))
    .filter(isUniversityDetail);
}

function getCoverageTone(metric: RegionMetric) {
  const rate = metric.coverageRate ?? 0;
  if (rate >= 0.2) return "is-hot";
  if (rate >= 0.1) return "is-warm";
  if (rate > 0) return "is-cool";
  return "is-zero";
}

function buildInsightItems(topRegions: RegionMetric[], bottomRegions: RegionMetric[], scopeLabel: string, regionLevel: string) {
  const best = topRegions[0];
  const lowest = bottomRegions[0];
  const strongest = topRegions.find((metric) => metric.universityCount > 0);

  return [
    best
      ? `${best.name}${regionLevel}覆盖率最高，达到 ${formatPercent(best.coverageRate)}。`
      : "请先补充分母数据，系统才能计算覆盖率排行。",
    strongest
      ? `${strongest.name}已覆盖 ${strongest.universityCount} 所高校，可作为${scopeLabel}重点样板区域。`
      : `当前${scopeLabel}筛选下暂无已覆盖高校。`,
    lowest
      ? `${lowest.name}${regionLevel}覆盖率最低，当前为 ${formatPercent(lowest.coverageRate)}，建议优先补强。`
      : "低覆盖区域将在导入分母后自动生成。",
    `${scopeLabel}视图按${regionLevel}统计，点击地图可继续下钻查看区域覆盖。`,
  ];
}

function readFileText(file: File) {
  if (typeof file.text === "function") return file.text();

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
    reader.addEventListener("error", () => reject(reader.error ?? new Error("CSV文件读取失败")));
    reader.readAsText(file);
  });
}

export function CoverageDashboard({ initialRecords }: CoverageDashboardProps = {}) {
  const [selectedProvince, setSelectedProvince] = useState<string>();
  const [selectedCity, setSelectedCity] = useState<string>();
  const [importMessage, setImportMessage] = useState<string>();
  const [adminHref, setAdminHref] = useState("/admin");
  const [coverageSort, setCoverageSort] = useState<{
    key: CoverageSortKey;
    direction: CoverageSortDirection;
  }>({ key: "coverageRate", direction: "desc" });
  const shellRef = useRef<HTMLElement>(null);
  const rankScopeRef = useRef<HTMLElement>(null);
  const {
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
    summary,
    provinceMetrics,
    loading,
    error,
    refresh,
  } = useCoverageData({ initialRecords });

  const orderedProducts = useMemo(() => {
    const known = PRODUCT_ORDER.filter((product) => productOptions.includes(product));
    const rest = productOptions.filter((product) => !known.includes(product));
    return [...known, ...rest];
  }, [productOptions]);
  const orderedPurchases = useMemo(() => {
    const known = PURCHASE_ORDER.filter((tag) => purchaseOptions.includes(tag));
    const rest = purchaseOptions.filter((tag) => !known.includes(tag));
    return [...known, ...rest];
  }, [purchaseOptions]);

  const metricMap = useMemo(() => getMetricMap(provinceMetrics), [provinceMetrics]);
  const activeScopeLabel = selectedPurchaseTags[0] ?? selectedProductTags[0] ?? "全部";
  const viewRecords = useMemo(
    () =>
      selectedProvince
        ? filteredRecords.filter(
            (record) => record.province === selectedProvince && (!selectedCity || record.city === selectedCity),
          )
        : filteredRecords,
    [filteredRecords, selectedCity, selectedProvince],
  );
  const cityMetrics = useMemo(
    () => (selectedProvince ? groupByCity(filteredRecords, selectedProvince, records) : []),
    [filteredRecords, records, selectedProvince],
  );
  const cityMetricMap = useMemo(() => getMetricMap(cityMetrics), [cityMetrics]);
  const mapMetrics = selectedProvince ? cityMetrics : provinceMetrics;
  const selectedMetric = selectedProvince ? metricMap.get(selectedProvince) : undefined;
  const selectedCityMetric = selectedCity ? cityMetricMap.get(selectedCity) : undefined;
  const activeMetric = selectedCity ? selectedCityMetric : selectedProvince ? selectedMetric : undefined;
  const activeCoveredCount = activeMetric?.universityCount ?? summary.universityCount;
  const activeTotalCount = activeMetric?.totalUniversityCount ?? summary.totalUniversityCount;
  const activeCoverageRate = activeMetric?.coverageRate ?? summary.coverageRate;
  const activeRegionCount = selectedProvince ? cityMetrics.length : provinceMetrics.length;
  const activeRegionLevel = selectedProvince ? "城市" : "省份";
  const sortedRegions = useMemo(
    () => sortCoverageMetrics(mapMetrics, coverageSort.key, coverageSort.direction),
    [coverageSort.direction, coverageSort.key, mapMetrics],
  );
  const universityCards = useMemo(() => getUniversityCards(viewRecords), [viewRecords]);
  const topRegions = useMemo(() => [...getRankableMetrics(mapMetrics)].sort(compareHigherCoverage).slice(0, 5), [mapMetrics]);
  const bottomRegions = useMemo(() => [...getRankableMetrics(mapMetrics)].sort(compareLowerCoverage).slice(0, 5), [mapMetrics]);
  const insightItems = useMemo(
    () => buildInsightItems(topRegions, bottomRegions, activeScopeLabel, activeRegionLevel),
    [activeRegionLevel, activeScopeLabel, bottomRegions, topRegions],
  );
  const isEmpty = !loading && records.length === 0;
  const mapHeading = selectedProvince
    ? selectedCity
      ? `${selectedProvince} / ${selectedCity}覆盖率热力图`
      : `${selectedProvince}城市覆盖率热力图`
    : `${activeScopeLabel}全国覆盖率热力图`;

  useEffect(() => {
    if (!shellRef.current || prefersReducedMotion()) return;
    const context = gsap.context(() => {
      gsap.fromTo(
        "[data-hero-motion]",
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.62, stagger: 0.08, ease: "power3.out" },
      );
    }, shellRef);
    return () => context.revert();
  }, []);

  useEffect(() => {
    if (window.location.protocol === "file:") {
      setAdminHref("./admin/index.html");
    }
  }, []);

  useEffect(() => {
    if (!rankScopeRef.current || prefersReducedMotion()) return;
    const context = gsap.context(() => {
      gsap.fromTo(
        "[data-rank-card]",
        { opacity: 0, x: 22 },
        { opacity: 1, x: 0, duration: 0.38, stagger: 0.035, ease: "power2.out" },
      );
    }, rankScopeRef);
    return () => context.revert();
  }, [
    coverageSort.direction,
    coverageSort.key,
    keyword,
    selectedCity,
    selectedProductTags,
    selectedProvince,
    selectedPurchaseTags,
    sortedRegions.length,
    universityCards.length,
  ]);

  const openProvince = useCallback((province: string) => {
    setSelectedProvince(province);
    setSelectedCity(undefined);
  }, []);

  const openCity = useCallback((city: string) => {
    setSelectedCity(city);
  }, []);

  const toggleProduct = (product: string) => {
    setSelectedProductTags(
      selectedProductTags.includes(product)
        ? selectedProductTags.filter((item) => item !== product)
        : [product],
    );
    setSelectedPurchaseTags([]);
    setSelectedProvince(undefined);
    setSelectedCity(undefined);
  };

  const togglePurchase = (tag: string) => {
    setSelectedPurchaseTags(selectedPurchaseTags.includes(tag) ? [] : [tag]);
    setSelectedProductTags([]);
    setSelectedProvince(undefined);
    setSelectedCity(undefined);
  };

  const backToCountry = () => {
    setSelectedProvince(undefined);
    setSelectedCity(undefined);
  };

  const changeCoverageSort = (key: CoverageSortKey) => {
    setCoverageSort((current) => ({
      key,
      direction: current.key === key && current.direction === "desc" ? "asc" : "desc",
    }));
  };

  const importCsv = async (file: File) => {
    const text = await readFileText(file);
    const result = parseDeliveryCsv(text);
    if (result.errors.length > 0) {
      setImportMessage(result.errors.slice(0, 2).join("；"));
      return;
    }

    const nextRecords = dedupeDeliveries(result.records.map(createDeliveryRecord));
    if (nextRecords.length === 0) {
      setImportMessage("CSV中没有可导入的记录，已保留现有数据。");
      return;
    }

    try {
      await createClientProvider().replaceAll(nextRecords);
      await refresh();
      backToCountry();
      const duplicateCount = result.records.length - nextRecords.length;
      setImportMessage(
        duplicateCount > 0
          ? `已导入 ${nextRecords.length} 条真实记录，自动忽略 ${duplicateCount} 条重复记录。`
          : `已导入 ${nextRecords.length} 条真实记录。`,
      );
    } catch (importError) {
      setImportMessage(importError instanceof Error ? importError.message : "CSV导入失败");
    }
  };

  return (
    <main className="coverage-shell" ref={shellRef}>
      <section className="coverage-command" aria-label="高校案例覆盖筛选" data-hero-motion>
        <div className="command-title">
          <span className="coverage-eyebrow">University Case Coverage</span>
          <h1>高校产品案例覆盖率热力图</h1>
        </div>
        <label className="coverage-search">
          <Search size={18} aria-hidden="true" />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索高校、设备、业务痛点"
            aria-label="搜索高校、设备、业务痛点"
          />
        </label>
        <div className="coverage-actions" aria-label="数据操作">
          <label className="file-action coverage-import-action">
            <FileUp size={16} aria-hidden="true" />
            导入CSV
            <input
              type="file"
              accept=".csv,text/csv"
              aria-label="首页CSV导入"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importCsv(file);
                event.target.value = "";
              }}
            />
          </label>
          <a className="ghost-action" href={adminHref}>
            进入录入页
          </a>
        </div>
      </section>

      {importMessage && <p className="import-message">{importMessage}</p>}

      <section className="product-dock" aria-label="产品筛选" data-hero-motion>
        <div className="tag-filter-group">
          <span>产品</span>
          {orderedProducts.map((product) => {
            const active = selectedProductTags.includes(product);
            return (
              <button
                className={active ? "product-tab is-active" : "product-tab"}
                key={product}
                type="button"
                aria-pressed={active}
                onClick={() => toggleProduct(product)}
              >
                <Boxes size={16} aria-hidden="true" />
                <span>{product}</span>
              </button>
            );
          })}
        </div>
        <div className="tag-filter-group">
          <span>采购</span>
          {orderedPurchases.map((tag) => {
            const active = selectedPurchaseTags.includes(tag);
            return (
              <button
                className={active ? "product-tab is-active is-purchase" : "product-tab is-purchase"}
                key={tag}
                type="button"
                aria-pressed={active}
                onClick={() => togglePurchase(tag)}
              >
                <ServerCog size={16} aria-hidden="true" />
                <span>{tag}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="overview-row" aria-label="统计口径与覆盖摘要" data-hero-motion>
        <article className="method-card">
          <strong>统计口径</strong>
          <p>
            分子：当前筛选下已覆盖高校数量；分母：对应省份或城市录入的高校总数。重复交付按同一高校去重，只计
            1 次覆盖。
          </p>
          <p>覆盖率 = 已覆盖高校 / 区域高校总数。</p>
        </article>
        <div className="metric-ribbon">
          <article>
            <MapPinned size={22} aria-hidden="true" />
            <span>{activeRegionLevel}总数</span>
            <strong>{activeRegionCount}</strong>
          </article>
          <article>
            <Target size={22} aria-hidden="true" />
            <span>覆盖数（分子）</span>
            <strong>{activeCoveredCount}</strong>
          </article>
          <article>
            <GraduationCap size={22} aria-hidden="true" />
            <span>总数（分母）</span>
            <strong>{activeTotalCount ?? "-"}</strong>
          </article>
          <article>
            <Database size={22} aria-hidden="true" />
            <span>整体覆盖率</span>
            <strong>{formatPercent(activeCoverageRate)}</strong>
          </article>
        </div>
      </section>

      <section className="coverage-workspace" data-hero-motion>
        <div className="map-console">
          <div className="console-heading">
            <div>
              <span>{selectedProvince ? "区域覆盖率热力图" : "全国省份覆盖率热力图"}</span>
              <h2>{mapHeading}</h2>
            </div>
            <div className="console-actions">
              {selectedProvince && (
                <button className="ghost-action" type="button" onClick={backToCountry}>
                  <ArrowLeft size={16} aria-hidden="true" />
                  返回全国
                </button>
              )}
              {selectedCity && (
                <button className="ghost-action" type="button" onClick={() => setSelectedCity(undefined)}>
                  <ArrowLeft size={16} aria-hidden="true" />
                  返回省份
                </button>
              )}
              {loading && <span className="status-pill">加载中</span>}
              {error && <span className="status-pill is-error">{error}</span>}
            </div>
          </div>

          <div className="map-stage" aria-label="覆盖率热力地图区域">
            <ChinaCoverageMap
              metrics={mapMetrics}
              selectedProvince={selectedProvince}
              selectedCity={selectedCity}
              onSelectProvince={openProvince}
              onSelectCity={openCity}
            />
            {selectedProvince && (
              <div className="province-lens" aria-label="当前区域">
                <span>{selectedCity ? "当前城市" : "当前省份"}</span>
                <strong>{selectedCity ?? selectedProvince}</strong>
                <p>
                  {formatCoverageFraction(
                    (selectedCity ? selectedCityMetric?.universityCount : selectedMetric?.universityCount) ?? 0,
                    selectedCity ? selectedCityMetric?.totalUniversityCount : selectedMetric?.totalUniversityCount,
                  )}
                  <br />
                  覆盖率 {formatPercent(selectedCity ? selectedCityMetric?.coverageRate : selectedMetric?.coverageRate)}
                </p>
              </div>
            )}
            {isEmpty && (
              <div className="empty-state">
                <span>等待真实数据</span>
                <strong>请先导入真实交付数据</strong>
                <p>支持 CSV 上传；导入后即可查看全国、省份、城市和高校覆盖情况。</p>
              </div>
            )}
          </div>

          {selectedProvince && (
            <div className="city-strip" aria-label={`${selectedProvince}地区覆盖`}>
              <span>地区覆盖</span>
              {cityMetrics.length > 0 ? (
                cityMetrics.map((city) => (
                  <button
                    className={city.name === selectedCity ? "city-chip is-active" : "city-chip"}
                    key={city.name}
                    type="button"
                    onClick={() => openCity(city.name)}
                  >
                    {city.name}
                    <small>{formatCoverageFraction(city.universityCount, city.totalUniversityCount)}</small>
                  </button>
                ))
              ) : (
                <small>当前产品暂无该省案例</small>
              )}
            </div>
          )}
        </div>

        <aside className="rank-console" ref={rankScopeRef}>
          <section className="rank-panel" aria-label={`${activeRegionLevel}覆盖率全量排行`}>
            <CoverageRankTable
              activeSort={coverageSort}
              emptyText={isEmpty ? "暂无真实数据" : "暂无可排行区域"}
              icon={<TrendingUp size={18} aria-hidden="true" />}
              metrics={sortedRegions}
              onSort={changeCoverageSort}
              regionLevel={activeRegionLevel}
            />
          </section>
          <section className="case-panel" aria-label={`${selectedCity ?? selectedProvince ?? "全国"}高校案例`}>
            <div className="case-heading">
              <div>
                <span>{selectedCity ?? selectedProvince ?? "全国"}高校案例</span>
                <h2>学校设备与业务痛点</h2>
              </div>
              <small>{universityCards.length} 所高校</small>
            </div>
            <div className="university-list">
              {universityCards.length === 0 && (
                <div className="empty-case-state">
                  <strong>{isEmpty ? "暂无真实数据" : "当前筛选暂无高校案例"}</strong>
                  <p>{isEmpty ? "请从首页导入 CSV，或进入录入页新增记录。" : "可调整产品、关键词或返回上一级区域。"}</p>
                </div>
              )}
              {universityCards.map((detail) => (
                <UniversityCaseCard detail={detail} key={`${detail.province}-${detail.city}-${detail.university}`} />
              ))}
            </div>
          </section>
        </aside>
      </section>

      <section className="insight-strip" aria-label="关键发现" data-hero-motion>
        <div className="insight-title">
          <Lightbulb size={22} aria-hidden="true" />
          <strong>关键发现</strong>
        </div>
        {insightItems.map((item) => (
          <p key={item}>{item}</p>
        ))}
      </section>
    </main>
  );
}

type CoverageRankTableProps = {
  activeSort: {
    key: CoverageSortKey;
    direction: CoverageSortDirection;
  };
  emptyText: string;
  icon: ReactNode;
  metrics: RegionMetric[];
  onSort(key: CoverageSortKey): void;
  regionLevel: string;
};

const SORT_LABELS: Record<CoverageSortKey, string> = {
  coverageRate: "覆盖率",
  universityCount: "覆盖数",
  totalUniversityCount: "分母",
};

type UniversityCaseCardProps = {
  detail: UniversityDetail;
};

function UniversityCaseCard({ detail }: UniversityCaseCardProps) {
  const equipmentDetails = getUniqueItems(detail.deliveries.flatMap((delivery) => delivery.equipmentDetails ?? []));
  const painPoints = getUniqueItems(detail.deliveries.flatMap((delivery) => delivery.painPoints ?? []));

  return (
    <article className="university-card" data-rank-card>
      <header>
        <div>
          <strong>{detail.university}</strong>
          <span>
            {detail.province} · {detail.city}
          </span>
        </div>
        <small>{detail.deliveries.length} 条交付</small>
      </header>
      <p>{formatTags(detail.productTags)}</p>
      <section className="detail-group" aria-label={`${detail.university}设备清单`}>
        <span className="detail-label">设备清单</span>
        <ul className="detail-list">
          {equipmentDetails.length > 0 ? (
            equipmentDetails.map((item) => <li key={item}>{item}</li>)
          ) : (
            <li className="is-muted">暂无设备明细</li>
          )}
        </ul>
      </section>
      <section className="detail-group" aria-label={`${detail.university}业务痛点`}>
        <span className="detail-label">业务痛点</span>
        <ul className="detail-list is-pain">
          {painPoints.length > 0 ? painPoints.map((item) => <li key={item}>{item}</li>) : <li className="is-muted">暂无痛点记录</li>}
        </ul>
      </section>
    </article>
  );
}

function CoverageRankTable({ activeSort, emptyText, icon, metrics, onSort, regionLevel }: CoverageRankTableProps) {
  const sortText = `${SORT_LABELS[activeSort.key]}${activeSort.direction === "desc" ? "降序" : "升序"}`;

  return (
    <article className="rank-card" data-rank-card>
      <header>
        <div>
          <span>{icon}</span>
          <h2>{regionLevel}覆盖率全量排行</h2>
        </div>
        <small>{metrics.length} 个{regionLevel} · 当前按{sortText}</small>
      </header>
      <div className="rank-table-wrap">
        <table className="rank-table">
          <thead>
            <tr>
              <th>排名</th>
              <th>区域</th>
              <th>
                <button
                  className={activeSort.key === "universityCount" ? "is-active" : undefined}
                  type="button"
                  onClick={() => onSort("universityCount")}
                >
                  覆盖数
                  <ArrowUpDown size={13} aria-hidden="true" />
                </button>
              </th>
              <th>
                <button
                  className={activeSort.key === "totalUniversityCount" ? "is-active" : undefined}
                  type="button"
                  onClick={() => onSort("totalUniversityCount")}
                >
                  分母
                  <ArrowUpDown size={13} aria-hidden="true" />
                </button>
              </th>
              <th>
                <button
                  className={activeSort.key === "coverageRate" ? "is-active" : undefined}
                  type="button"
                  onClick={() => onSort("coverageRate")}
                >
                  覆盖率
                  <ArrowUpDown size={13} aria-hidden="true" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {metrics.length === 0 ? (
              <tr>
                <td colSpan={5}>{emptyText}</td>
              </tr>
            ) : (
              metrics.map((metric, index) => (
                <tr key={metric.name}>
                  <td>{index + 1}</td>
                  <td>{metric.name}</td>
                  <td>{metric.universityCount}</td>
                  <td>{metric.totalUniversityCount ?? "-"}</td>
                  <td>
                    <strong className={getCoverageTone(metric)}>{formatPercent(metric.coverageRate)}</strong>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}
