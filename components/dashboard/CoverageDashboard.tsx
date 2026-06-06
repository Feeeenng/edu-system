"use client";

import { ArrowLeft, Boxes, Database, GraduationCap, MapPinned, Search, ServerCog } from "lucide-react";
import { gsap } from "gsap";
import { useEffect, useMemo, useRef, useState } from "react";
import { getUniversityDetail, groupByCity } from "@/lib/analytics/summary";
import { useCoverageData } from "@/components/dashboard/useCoverageData";
import type { DeliveryRecord, RegionMetric, UniversityDetail } from "@/lib/types";
import type { CSSProperties, KeyboardEvent } from "react";
import "./coverage-dashboard.css";

const PRODUCT_ORDER = ["SDDC", "EDS", "桌面云", "FastGPT"];

type CoverageDashboardProps = {
  initialRecords?: DeliveryRecord[];
};

type ChinaMapRegion = {
  province: string;
  shortName: string;
  path: string;
  labelX: number;
  labelY: number;
};

const CHINA_MAP_REGIONS: ChinaMapRegion[] = [
  { province: "新疆维吾尔自治区", shortName: "新疆", path: "M70 145 L210 100 L300 155 L285 258 L185 302 L90 248 Z", labelX: 177, labelY: 205 },
  { province: "西藏自治区", shortName: "西藏", path: "M76 316 L195 302 L292 352 L260 448 L128 448 L54 386 Z", labelX: 175, labelY: 384 },
  { province: "青海省", shortName: "青海", path: "M245 260 L356 246 L392 332 L300 366 L195 302 Z", labelX: 303, labelY: 315 },
  { province: "甘肃省", shortName: "甘肃", path: "M302 156 L422 176 L440 230 L356 246 L285 258 Z", labelX: 366, labelY: 205 },
  { province: "内蒙古自治区", shortName: "内蒙古", path: "M410 102 L690 70 L765 126 L720 186 L585 162 L450 190 L422 176 Z", labelX: 580, labelY: 128 },
  { province: "黑龙江省", shortName: "黑龙江", path: "M705 70 L805 65 L835 136 L780 172 L724 130 Z", labelX: 780, labelY: 118 },
  { province: "吉林省", shortName: "吉林", path: "M715 166 L786 172 L790 220 L720 218 L695 190 Z", labelX: 742, labelY: 198 },
  { province: "辽宁省", shortName: "辽宁", path: "M650 202 L720 218 L710 270 L635 260 L610 226 Z", labelX: 664, labelY: 240 },
  { province: "北京市", shortName: "北京", path: "M574 235 L596 238 L592 260 L570 258 Z", labelX: 584, labelY: 250 },
  { province: "天津市", shortName: "天津", path: "M596 258 L615 264 L610 283 L590 276 Z", labelX: 604, labelY: 275 },
  { province: "河北省", shortName: "河北", path: "M555 236 L625 226 L638 292 L595 336 L540 316 L520 266 Z", labelX: 574, labelY: 296 },
  { province: "山东省", shortName: "山东", path: "M615 316 L706 310 L736 360 L680 402 L600 370 Z", labelX: 668, labelY: 356 },
  { province: "山西省", shortName: "山西", path: "M475 236 L525 262 L540 316 L500 360 L455 322 L445 262 Z", labelX: 492, labelY: 300 },
  { province: "宁夏回族自治区", shortName: "宁夏", path: "M385 226 L430 232 L420 276 L382 286 Z", labelX: 407, labelY: 258 },
  { province: "陕西省", shortName: "陕西", path: "M405 250 L455 322 L490 396 L455 470 L390 430 L365 332 Z", labelX: 432, labelY: 385 },
  { province: "河南省", shortName: "河南", path: "M510 346 L595 336 L620 390 L565 446 L495 406 Z", labelX: 558, labelY: 394 },
  { province: "江苏省", shortName: "江苏", path: "M655 396 L720 396 L735 456 L680 470 L635 436 Z", labelX: 685, labelY: 430 },
  { province: "上海市", shortName: "上海", path: "M735 456 L755 462 L752 482 L730 476 Z", labelX: 743, labelY: 472 },
  { province: "安徽省", shortName: "安徽", path: "M590 406 L635 436 L680 470 L640 526 L575 490 L560 446 Z", labelX: 620, labelY: 474 },
  { province: "湖北省", shortName: "湖北", path: "M490 406 L565 446 L575 490 L520 536 L455 500 L455 470 Z", labelX: 516, labelY: 486 },
  { province: "四川省", shortName: "四川", path: "M300 366 L390 430 L455 470 L455 520 L365 556 L275 500 L260 448 Z", labelX: 365, labelY: 488 },
  { province: "重庆市", shortName: "重庆", path: "M430 455 L470 476 L465 516 L425 520 L410 486 Z", labelX: 442, labelY: 492 },
  { province: "贵州省", shortName: "贵州", path: "M365 556 L455 520 L500 570 L460 620 L365 610 Z", labelX: 432, labelY: 575 },
  { province: "云南省", shortName: "云南", path: "M260 500 L365 556 L365 610 L280 626 L210 560 Z", labelX: 300, labelY: 574 },
  { province: "湖南省", shortName: "湖南", path: "M455 505 L520 536 L535 550 L510 615 L460 620 L420 560 Z", labelX: 482, labelY: 565 },
  { province: "江西省", shortName: "江西", path: "M575 500 L640 526 L646 590 L585 602 L535 550 Z", labelX: 590, labelY: 556 },
  { province: "浙江省", shortName: "浙江", path: "M680 480 L730 476 L740 536 L690 570 L646 530 Z", labelX: 695, labelY: 526 },
  { province: "福建省", shortName: "福建", path: "M646 590 L690 570 L708 630 L660 622 Z", labelX: 672, labelY: 605 },
  { province: "广东省", shortName: "广东", path: "M585 602 L660 586 L708 630 L670 666 L585 660 L550 630 Z", labelX: 628, labelY: 636 },
  { province: "广西壮族自治区", shortName: "广西", path: "M460 620 L500 570 L585 602 L550 630 L495 658 Z", labelX: 516, labelY: 624 },
  { province: "海南省", shortName: "海南", path: "M606 690 L650 682 L672 708 L635 732 L592 714 Z", labelX: 630, labelY: 710 },
];

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
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function getMetricMap(metrics: RegionMetric[]) {
  return new Map(metrics.map((metric) => [metric.name, metric]));
}

function getIntensity(metric: RegionMetric | undefined, maxDeliveries: number) {
  if (!metric || maxDeliveries <= 0) return 0;
  return Math.max(0.18, metric.deliveryCount / maxDeliveries);
}

function getRegionFill(intensity: number, selected: boolean) {
  if (selected) return "#f59e0b";
  if (intensity <= 0) return "#22332d";
  return `hsl(168 58% ${24 + intensity * 34}%)`;
}

function getUniversityCards(records: DeliveryRecord[]) {
  const seen = new Set<string>();
  return records
    .filter((record) => {
      // 同一高校可能存在多次交付，列表入口按高校维度聚合。
      const key = `${record.province}/${record.city}/${record.university}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((record) => getUniversityDetail(records, record.province, record.city, record.university))
    .filter(isUniversityDetail);
}

export function CoverageDashboard({ initialRecords }: CoverageDashboardProps = {}) {
  const [selectedProvince, setSelectedProvince] = useState<string>();
  const mapScopeRef = useRef<HTMLDivElement>(null);
  const caseScopeRef = useRef<HTMLDivElement>(null);
  const {
    filteredRecords,
    productOptions,
    selectedProductTags,
    setSelectedProductTags,
    keyword,
    setKeyword,
    summary,
    provinceMetrics,
    loading,
    error,
  } = useCoverageData({ initialRecords });

  const orderedProducts = useMemo(() => {
    const known = PRODUCT_ORDER.filter((product) => productOptions.includes(product));
    const rest = productOptions.filter((product) => !known.includes(product));
    return [...known, ...rest];
  }, [productOptions]);

  const metricMap = useMemo(() => getMetricMap(provinceMetrics), [provinceMetrics]);
  const maxProvinceDeliveries = Math.max(1, ...provinceMetrics.map((metric) => metric.deliveryCount));
  const productLabel = selectedProductTags[0] ?? "全部产品";
  const viewRecords = useMemo(
    () =>
      selectedProvince
        ? filteredRecords.filter((record) => record.province === selectedProvince)
        : filteredRecords,
    [filteredRecords, selectedProvince],
  );
  const cityMetrics = useMemo(
    () => (selectedProvince ? groupByCity(filteredRecords, selectedProvince) : []),
    [filteredRecords, selectedProvince],
  );
  const universityCards = useMemo(() => getUniversityCards(viewRecords), [viewRecords]);
  const selectedMetric = selectedProvince ? metricMap.get(selectedProvince) : undefined;
  const mapHeading = selectedProvince ? `${selectedProvince}覆盖详情` : `${productLabel} 全国案例覆盖`;

  useEffect(() => {
    if (!mapScopeRef.current || prefersReducedMotion()) return;
    const context = gsap.context(() => {
      gsap.fromTo(
        "[data-map-region]",
        { opacity: 0.5, y: 8 },
        { opacity: 1, y: 0, duration: 0.48, stagger: 0.012, ease: "power3.out" },
      );
    }, mapScopeRef);
    return () => context.revert();
  }, [selectedProvince, selectedProductTags, keyword]);

  useEffect(() => {
    if (!caseScopeRef.current || prefersReducedMotion()) return;
    const context = gsap.context(() => {
      gsap.fromTo(
        "[data-case-card]",
        { opacity: 0, x: 20 },
        { opacity: 1, x: 0, duration: 0.36, stagger: 0.035, ease: "power2.out" },
      );
    }, caseScopeRef);
    return () => context.revert();
  }, [selectedProvince, selectedProductTags, keyword, universityCards.length]);

  const toggleProduct = (product: string) => {
    setSelectedProductTags(
      selectedProductTags.includes(product)
        ? selectedProductTags.filter((item) => item !== product)
        : [product],
    );
    setSelectedProvince(undefined);
  };

  const openProvince = (province: string) => {
    setSelectedProvince(province);
  };

  const handleRegionKeyDown = (event: KeyboardEvent<SVGGElement>, province: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openProvince(province);
    }
  };

  return (
    <main className="coverage-shell">
      <section className="coverage-command" aria-label="高校案例覆盖筛选">
        <div className="command-title">
          <span className="coverage-eyebrow">Edu Coverage Console</span>
          <h1>高校产品案例覆盖地图</h1>
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
      </section>

      <section className="product-dock" aria-label="产品筛选">
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
      </section>

      <section className="metric-ribbon" aria-label="覆盖摘要">
        <article>
          <MapPinned size={18} aria-hidden="true" />
          <span>覆盖省份</span>
          <strong>{summary.provinceCount}</strong>
        </article>
        <article>
          <GraduationCap size={18} aria-hidden="true" />
          <span>覆盖高校</span>
          <strong>{summary.universityCount}</strong>
        </article>
        <article>
          <Database size={18} aria-hidden="true" />
          <span>交付案例</span>
          <strong>{summary.deliveryCount}</strong>
        </article>
        <article>
          <ServerCog size={18} aria-hidden="true" />
          <span>当前视图高校</span>
          <strong>{universityCards.length}</strong>
        </article>
      </section>

      <section className="coverage-workspace">
        <div className="map-console" ref={mapScopeRef}>
          <div className="console-heading">
            <div>
              <span>全国 → 省份钻取</span>
              <h2>{mapHeading}</h2>
            </div>
            <div className="console-actions">
              {selectedProvince && (
                <button className="ghost-action" type="button" onClick={() => setSelectedProvince(undefined)}>
                  <ArrowLeft size={16} aria-hidden="true" />
                  返回全国
                </button>
              )}
              {loading && <span className="status-pill">加载中</span>}
              {error && <span className="status-pill is-error">{error}</span>}
            </div>
          </div>

          <div className={selectedProvince ? "map-stage is-drilled" : "map-stage"} role="img" aria-label="全国高校案例覆盖地图">
            <svg className="china-map" viewBox="0 0 880 760" aria-hidden="false">
              <defs>
                <filter id="region-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="10" stdDeviation="8" floodColor="#00130f" floodOpacity="0.32" />
                </filter>
              </defs>
              {CHINA_MAP_REGIONS.map((region) => {
                const metric = metricMap.get(region.province);
                const intensity = getIntensity(metric, maxProvinceDeliveries);
                const selected = selectedProvince === region.province;
                return (
                  <g
                    aria-label={`${region.province} ${metric?.universityCount ?? 0} 所高校 ${metric?.deliveryCount ?? 0} 个案例`}
                    className={selected ? "map-region is-selected" : "map-region"}
                    data-map-region
                    key={region.province}
                    role="button"
                    tabIndex={0}
                    onClick={() => openProvince(region.province)}
                    onKeyDown={(event) => handleRegionKeyDown(event, region.province)}
                    style={
                      {
                        "--coverage-intensity": intensity,
                        "--region-fill": getRegionFill(intensity, selected),
                      } as CSSProperties
                    }
                  >
                    <path className="region-shape" d={region.path} />
                    <text className="region-label" x={region.labelX} y={region.labelY}>
                      {region.shortName}
                    </text>
                    {metric && (
                      <circle
                        className="region-dot"
                        cx={region.labelX + 22}
                        cy={region.labelY - 18}
                        r={4 + Math.min(metric.deliveryCount, 12)}
                      />
                    )}
                  </g>
                );
              })}
            </svg>

            {selectedProvince && (
              <div className="province-lens" data-map-region>
                <span>当前省份</span>
                <strong>{selectedProvince}</strong>
                <p>
                  {selectedMetric?.universityCount ?? 0} 所高校 / {selectedMetric?.deliveryCount ?? 0} 个案例
                </p>
              </div>
            )}
          </div>

          {selectedProvince && (
            <div className="city-strip" aria-label={`${selectedProvince}地区覆盖`}>
              <span>地区覆盖</span>
              {cityMetrics.length > 0 ? (
                cityMetrics.map((city) => (
                  <button className="city-chip" key={city.name} type="button">
                    {city.name}
                    <small>{city.universityCount} 所</small>
                  </button>
                ))
              ) : (
                <small>当前产品暂无该省案例</small>
              )}
            </div>
          )}
        </div>

        <aside className="case-console" ref={caseScopeRef}>
          <div className="console-heading">
            <div>
              <span>{selectedProvince ?? "全国"}高校案例</span>
              <h2>学校设备与业务痛点</h2>
            </div>
          </div>

          <div className="university-list">
            {universityCards.map((detail) => {
              const equipmentDetails = getUniqueItems(
                detail.deliveries.flatMap((delivery) => delivery.equipmentDetails ?? []),
              );
              const painPoints = getUniqueItems(detail.deliveries.flatMap((delivery) => delivery.painPoints ?? []));
              return (
                <article className="university-card" data-case-card key={`${detail.province}-${detail.city}-${detail.university}`}>
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
                      {painPoints.length > 0 ? (
                        painPoints.map((item) => <li key={item}>{item}</li>)
                      ) : (
                        <li className="is-muted">暂无痛点记录</li>
                      )}
                    </ul>
                  </section>
                </article>
              );
            })}
          </div>
        </aside>
      </section>
    </main>
  );
}
