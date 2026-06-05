"use client";

import { Database, GraduationCap, Layers3, MapPin, Search } from "lucide-react";
import { useMemo } from "react";
import { getUniversityDetail } from "@/lib/analytics/summary";
import { useCoverageData } from "@/components/dashboard/useCoverageData";
import type { DeliveryRecord, RegionMetric, UniversityDetail } from "@/lib/types";
import type { CSSProperties } from "react";
import "./coverage-dashboard.css";

const PRODUCT_ORDER = ["SDDC", "EDS", "桌面云", "FastGPT"];

type CoverageDashboardProps = {
  initialRecords?: DeliveryRecord[];
};

function formatTags(tags: string[]) {
  return tags.length > 0 ? tags.join(" / ") : "暂无标签";
}

function getUniqueItems(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

// 根据当前筛选后的最大案例数计算省份热力强度，避免低覆盖省份完全不可见。
function getIntensity(metric: RegionMetric, maxDeliveries: number) {
  if (maxDeliveries <= 0) return 0;
  return Math.max(0.18, metric.deliveryCount / maxDeliveries);
}

function isUniversityDetail(value: UniversityDetail | undefined): value is UniversityDetail {
  return value !== undefined;
}

export function CoverageDashboard({ initialRecords }: CoverageDashboardProps = {}) {
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

  const maxProvinceDeliveries = Math.max(1, ...provinceMetrics.map((metric) => metric.deliveryCount));
  const universityCards = useMemo(() => {
    const seen = new Set<string>();
    return filteredRecords
      .filter((record) => {
        // 同一高校可能有多条交付记录，列表层只展示高校维度的聚合入口。
        const key = `${record.province}/${record.city}/${record.university}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((record) => getUniversityDetail(filteredRecords, record.province, record.city, record.university))
      .filter(isUniversityDetail);
  }, [filteredRecords]);

  const toggleProduct = (product: string) => {
    setSelectedProductTags(
      selectedProductTags.includes(product)
        ? selectedProductTags.filter((item) => item !== product)
        : [product],
    );
  };

  return (
    <main className="coverage-shell">
      <section className="coverage-toolbar" aria-label="产品案例覆盖筛选">
        <div>
          <p className="coverage-eyebrow">高校产品案例覆盖</p>
          <h1>按产品查看全国高校覆盖版图</h1>
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

      <section className="product-strip" aria-label="产品筛选">
        {orderedProducts.map((product) => {
          const active = selectedProductTags.includes(product);
          return (
            <button
              className={active ? "product-chip is-active" : "product-chip"}
              key={product}
              type="button"
              aria-pressed={active}
              onClick={() => toggleProduct(product)}
            >
              <Layers3 size={16} aria-hidden="true" />
              <span>{product}</span>
            </button>
          );
        })}
      </section>

      <section className="kpi-grid" aria-label="覆盖摘要">
        <article>
          <MapPin size={18} aria-hidden="true" />
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
      </section>

      <section className="dashboard-grid">
        <div className="map-panel">
          <div className="panel-heading">
            <div>
              <p>全国覆盖版图</p>
              <h2>{selectedProductTags[0] ?? "全部产品"} 案例分布</h2>
            </div>
            {loading && <span className="status-pill">加载中</span>}
            {error && <span className="status-pill is-error">{error}</span>}
          </div>
          <div className="province-map" aria-label="省份覆盖热力网格">
            {provinceMetrics.map((metric) => {
              const intensity = getIntensity(metric, maxProvinceDeliveries);
              return (
                <article
                  className="province-cell"
                  key={metric.name}
                  style={{ "--coverage-intensity": intensity } as CSSProperties}
                >
                  <span>{metric.name.replace(/[省市自治区壮族回族维吾尔]/g, "")}</span>
                  <strong>{metric.universityCount}</strong>
                  <small>{metric.deliveryCount} 个案例</small>
                </article>
              );
            })}
          </div>
        </div>

        <aside className="case-panel">
          <div className="panel-heading">
            <div>
              <p>高校案例</p>
              <h2>设备与业务痛点</h2>
            </div>
          </div>
          <div className="university-list">
            {universityCards.map((detail) => {
              const equipmentDetails = getUniqueItems(
                detail.deliveries.flatMap((delivery) => delivery.equipmentDetails ?? []),
              );
              const painPoints = getUniqueItems(detail.deliveries.flatMap((delivery) => delivery.painPoints ?? []));
              return (
                <article className="university-card" key={`${detail.province}-${detail.city}-${detail.university}`}>
                  <div>
                    <strong>{detail.university}</strong>
                    <span>
                      {detail.province} · {detail.city}
                    </span>
                  </div>
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
