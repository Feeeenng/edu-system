"use client";

import {
  ArrowLeft,
  ArrowUpDown,
  Boxes,
  Database,
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
import { getUniversityDetail } from "@/lib/analytics/summary";
import { ChinaCoverageMap } from "@/components/dashboard/ChinaCoverageMap";
import { useCoverageData } from "@/components/dashboard/useCoverageData";
import { readSiteConfig } from "@/lib/data/site-config-client";
import { DEFAULT_SITE_CONFIG, normalizeSiteConfig } from "@/lib/site-config";
import type { DeliveryRecord, RegionMetric, SiteConfig, UniversityDetail } from "@/lib/types";
import "./coverage-dashboard.css";

const PRODUCT_ORDER = ["SDDC", "EDS", "桌面云", "FastGPT"];
const PURCHASE_ORDER = ["VMware替换", "信创", "AI超融合"];

type CoverageDashboardProps = {
  initialRecords?: DeliveryRecord[];
  initialSiteConfig?: SiteConfig;
};

type CoverageSortKey = "coverageRate" | "universityCount" | "totalUniversityCount";
type CoverageSortDirection = "asc" | "desc";
type RightPanelTab = "coverage" | "cases";
type ProvinceCaseGroup = {
  province: string;
  cases: UniversityDetail[];
};

function schoolKey(record: DeliveryRecord) {
  return record.schoolId?.trim() || `${record.province}/${record.city}/${record.university}`;
}

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
      const key = schoolKey(record);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((record) => getUniversityDetail(records, record.province, record.city, record.university))
    .filter(isUniversityDetail);
}

function isCoveredRecord(record: DeliveryRecord) {
  return record.coverageStatus === "已部署";
}

function groupUniversityCardsByProvince(cards: UniversityDetail[]): ProvinceCaseGroup[] {
  const groups = new Map<string, UniversityDetail[]>();
  for (const card of cards) {
    const group = groups.get(card.province);
    if (group) {
      group.push(card);
    } else {
      groups.set(card.province, [card]);
    }
  }

  return Array.from(groups.entries())
    .map(([province, cases]) => ({
      province,
      cases: cases.sort(
        (a, b) =>
          b.deliveries.length - a.deliveries.length ||
          a.city.localeCompare(b.city, "zh-CN") ||
          a.university.localeCompare(b.university, "zh-CN"),
      ),
    }))
    .sort((a, b) => b.cases.length - a.cases.length || a.province.localeCompare(b.province, "zh-CN"));
}

function getCoverageTone(metric: RegionMetric) {
  const rate = metric.coverageRate ?? 0;
  if (rate >= 0.5) return "is-strong";
  if (rate >= 0.35) return "is-good";
  if (rate >= 0.2) return "is-warm";
  if (rate >= 0.1) return "is-watch";
  if (rate > 0) return "is-risk";
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
      ? `${strongest.name}已部署 ${strongest.universityCount} 所高校，可作为${scopeLabel}重点样板区域。`
      : `当前${scopeLabel}筛选下暂无已部署记录。`,
    lowest
      ? `${lowest.name}${regionLevel}覆盖率最低，当前为 ${formatPercent(lowest.coverageRate)}，建议优先补强。`
      : "低覆盖区域将在导入分母后自动生成。",
    `${scopeLabel}视图按${regionLevel}统计，点击地图可切换省份范围查看覆盖。`,
  ];
}

export function CoverageDashboard({ initialRecords, initialSiteConfig }: CoverageDashboardProps = {}) {
  const [selectedProvince, setSelectedProvince] = useState<string>();
  const [adminHref, setAdminHref] = useState("/admin");
  const [siteConfig, setSiteConfig] = useState(() => normalizeSiteConfig(initialSiteConfig ?? DEFAULT_SITE_CONFIG));
  const [coverageSort, setCoverageSort] = useState<{
    key: CoverageSortKey;
    direction: CoverageSortDirection;
  }>({ key: "coverageRate", direction: "desc" });
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>("coverage");
  const [caseProvinceFilter, setCaseProvinceFilter] = useState("");
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
  } = useCoverageData({ initialRecords });

  const orderedProducts = useMemo(() => {
    const rest = productOptions.filter((product) => !PRODUCT_ORDER.includes(product));
    return [...PRODUCT_ORDER, ...rest];
  }, [productOptions]);
  const orderedPurchases = useMemo(() => {
    const known = PURCHASE_ORDER.filter((tag) => purchaseOptions.includes(tag));
    const rest = purchaseOptions.filter((tag) => !known.includes(tag));
    return [...known, ...rest];
  }, [purchaseOptions]);

  const metricMap = useMemo(() => getMetricMap(provinceMetrics), [provinceMetrics]);
  const activeScopeLabel =
    keyword.trim() ? `搜索：${keyword.trim()}` : selectedPurchaseTags[0] ?? selectedProductTags[0] ?? "交付部署";
  const viewRecords = useMemo(
    () =>
      selectedProvince ? filteredRecords.filter((record) => record.province === selectedProvince) : filteredRecords,
    [filteredRecords, selectedProvince],
  );
  const mapMetrics = provinceMetrics;
  const selectedMetric = selectedProvince ? metricMap.get(selectedProvince) : undefined;
  const activeMetric = selectedProvince ? selectedMetric : undefined;
  const activeCoveredCount = activeMetric?.universityCount ?? summary.universityCount;
  const activeTotalCount = activeMetric?.totalUniversityCount ?? summary.totalUniversityCount;
  const activeCoverageRate = activeMetric?.coverageRate ?? summary.coverageRate;
  const activeRegionCount = provinceMetrics.length;
  const activeRegionLevel = "省份";
  const sortedRegions = useMemo(
    () => sortCoverageMetrics(mapMetrics, coverageSort.key, coverageSort.direction),
    [coverageSort.direction, coverageSort.key, mapMetrics],
  );
  const universityCards = useMemo(() => getUniversityCards(viewRecords.filter(isCoveredRecord)), [viewRecords]);
  const provinceCaseGroups = useMemo(() => groupUniversityCardsByProvince(universityCards), [universityCards]);
  const topRegions = useMemo(() => [...getRankableMetrics(mapMetrics)].sort(compareHigherCoverage).slice(0, 5), [mapMetrics]);
  const bottomRegions = useMemo(() => [...getRankableMetrics(mapMetrics)].sort(compareLowerCoverage).slice(0, 5), [mapMetrics]);
  const insightItems = useMemo(
    () => buildInsightItems(topRegions, bottomRegions, activeScopeLabel, activeRegionLevel),
    [activeRegionLevel, activeScopeLabel, bottomRegions, topRegions],
  );
  const isEmpty = !loading && records.length === 0;
  const mapHeading = selectedProvince ? `${selectedProvince}覆盖率热力图` : `${activeScopeLabel}全国覆盖率热力图`;

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
    if (initialSiteConfig) return;

    let active = true;
    void readSiteConfig()
      .then((config) => {
        if (active && config) setSiteConfig(normalizeSiteConfig(config));
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [initialSiteConfig]);

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
    selectedProductTags,
    selectedProvince,
    selectedPurchaseTags,
    sortedRegions.length,
    universityCards.length,
  ]);

  useEffect(() => {
    if (!caseProvinceFilter) return;
    if (!provinceCaseGroups.some((group) => group.province === caseProvinceFilter)) {
      setCaseProvinceFilter("");
    }
  }, [caseProvinceFilter, provinceCaseGroups]);

  const openProvince = useCallback((province: string) => {
    setSelectedProvince(province);
    setRightPanelTab("cases");
  }, []);

  const toggleProduct = (product: string) => {
    setSelectedProductTags(
      selectedProductTags.includes(product)
        ? selectedProductTags.filter((item) => item !== product)
        : [product],
    );
    setSelectedPurchaseTags([]);
    setSelectedProvince(undefined);
    setRightPanelTab("coverage");
  };

  const togglePurchase = (tag: string) => {
    setSelectedPurchaseTags(selectedPurchaseTags.includes(tag) ? [] : [tag]);
    setSelectedProductTags([]);
    setSelectedProvince(undefined);
    setRightPanelTab("coverage");
  };

  const backToCountry = () => {
    setSelectedProvince(undefined);
    setRightPanelTab("coverage");
  };

  const changeCoverageSort = (key: CoverageSortKey) => {
    setCoverageSort((current) => ({
      key,
      direction: current.key === key && current.direction === "desc" ? "asc" : "desc",
    }));
  };

  return (
    <main className="coverage-shell" ref={shellRef}>
      <section className="coverage-command" aria-label="高校案例覆盖筛选" data-hero-motion>
        <div className="command-title">
          <span className="coverage-eyebrow">University Case Coverage</span>
          <h1>{siteConfig.dashboardTitle}</h1>
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
          <a className="ghost-action" href={adminHref}>
            进入录入页
          </a>
        </div>
      </section>

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
          <span>产品标签</span>
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
            分子：当前区域内覆盖状态为“已部署”的高校数量；分母：后端已导入的高校数量。
          </p>
          <p>覆盖率 = 已部署高校数 / 当前筛选范围内高校总数，学校按高校名称去重。</p>
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
            <span>高校总数（分母）</span>
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
              <span>{selectedProvince ? "省份覆盖率热力图" : "全国省份覆盖率热力图"}</span>
              <h2>{mapHeading}</h2>
            </div>
            <div className="console-actions">
              {selectedProvince && (
                <button className="ghost-action" type="button" onClick={backToCountry}>
                  <ArrowLeft size={16} aria-hidden="true" />
                  返回全国
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
              onSelectProvince={openProvince}
            />
            {selectedProvince && (
              <div className="province-lens" aria-label="当前区域">
                <span>当前省份</span>
                <strong>{selectedProvince}</strong>
                <p>
                  {formatCoverageFraction(selectedMetric?.universityCount ?? 0, selectedMetric?.totalUniversityCount)}
                  <br />
                  覆盖率 {formatPercent(selectedMetric?.coverageRate)}
                </p>
              </div>
            )}
            {isEmpty && (
              <div className="empty-state">
                <span>等待真实数据</span>
                <strong>请先导入真实交付数据</strong>
                <p>请进入录入页新增记录或导入 XLSX；完成后即可查看全国、省份和高校覆盖情况。</p>
              </div>
            )}
          </div>
        </div>

        <aside className="rank-console" ref={rankScopeRef}>
          <div className="right-panel-tabs" role="tablist" aria-label="右侧数据切换">
            <button
              aria-controls="coverage-rank-panel"
              aria-selected={rightPanelTab === "coverage"}
              className={rightPanelTab === "coverage" ? "is-active" : undefined}
              id="coverage-rank-tab"
              role="tab"
              type="button"
              onClick={() => setRightPanelTab("coverage")}
            >
              <span>区域覆盖率</span>
              <strong>{sortedRegions.length}</strong>
            </button>
            <button
              aria-controls="university-case-panel"
              aria-selected={rightPanelTab === "cases"}
              className={rightPanelTab === "cases" ? "is-active" : undefined}
              id="university-case-tab"
              role="tab"
              type="button"
              onClick={() => setRightPanelTab("cases")}
            >
              <span>高校案例</span>
              <strong>{universityCards.length}</strong>
            </button>
          </div>
          <section
            aria-labelledby="coverage-rank-tab"
            className={rightPanelTab === "coverage" ? "rank-panel is-active" : "rank-panel"}
            hidden={rightPanelTab !== "coverage"}
            id="coverage-rank-panel"
            role="tabpanel"
          >
            <CoverageRankTable
              activeSort={coverageSort}
              emptyText={isEmpty ? "暂无真实数据" : "暂无可排行区域"}
              icon={<TrendingUp size={18} aria-hidden="true" />}
              metrics={sortedRegions}
              onSort={changeCoverageSort}
              regionLevel={activeRegionLevel}
            />
          </section>
          <section
            aria-labelledby="university-case-tab"
            className={rightPanelTab === "cases" ? "case-panel is-active" : "case-panel"}
            hidden={rightPanelTab !== "cases"}
            id="university-case-panel"
            role="tabpanel"
          >
            <UniversityCasePanel
              caseProvinceFilter={caseProvinceFilter}
              isEmpty={isEmpty}
              onCaseProvinceFilterChange={setCaseProvinceFilter}
              provinceCaseGroups={provinceCaseGroups}
              universityCards={universityCards}
            />
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

type UniversityCasePanelProps = {
  caseProvinceFilter: string;
  isEmpty: boolean;
  onCaseProvinceFilterChange(province: string): void;
  provinceCaseGroups: ProvinceCaseGroup[];
  universityCards: UniversityDetail[];
};

function UniversityCasePanel({
  caseProvinceFilter,
  isEmpty,
  onCaseProvinceFilterChange,
  provinceCaseGroups,
  universityCards,
}: UniversityCasePanelProps) {
  const selectedGroup = provinceCaseGroups.find((group) => group.province === caseProvinceFilter) ?? provinceCaseGroups[0];

  return (
    <div className="university-list">
      <div className="case-filter-row">
        <div>
          <span>已部署高校</span>
          <strong>{universityCards.length} 所</strong>
        </div>
        <label>
          <span className="sr-only">按省份筛选高校案例</span>
          <select
            aria-label="按省份筛选高校案例"
            disabled={provinceCaseGroups.length === 0}
            value={selectedGroup?.province ?? ""}
            onChange={(event) => onCaseProvinceFilterChange(event.target.value)}
          >
            {provinceCaseGroups.length === 0 ? (
              <option value="">暂无省份</option>
            ) : (
              provinceCaseGroups.map((group) => (
                <option key={group.province} value={group.province}>
                  {group.province}（{group.cases.length}）
                </option>
              ))
            )}
          </select>
        </label>
      </div>
      {universityCards.length === 0 && (
        <div className="empty-case-state">
          <strong>{isEmpty ? "暂无真实数据" : "当前筛选暂无已部署学校"}</strong>
          <p>{isEmpty ? "请进入录入页新增记录或导入 XLSX。" : "未部署学校保留在地图分母中，右侧只展示已部署明细。"}</p>
        </div>
      )}
      {selectedGroup && (
        <section className="province-case-group" key={selectedGroup.province} aria-label={`${selectedGroup.province}高校案例`}>
          <header>
            <strong>{selectedGroup.province}</strong>
            <small>{selectedGroup.cases.length} 所高校</small>
          </header>
          <div className="province-case-list">
            {selectedGroup.cases.map((detail) => (
              <UniversityCaseCard detail={detail} key={`${detail.province}-${detail.city}-${detail.university}`} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

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
            {detail.deliveries[0]?.schoolId ? ` · ${detail.deliveries[0].schoolId}` : ""}
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
