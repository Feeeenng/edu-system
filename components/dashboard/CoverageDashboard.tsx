"use client";

import { ArrowLeft, Boxes, Database, FileUp, GraduationCap, MapPinned, Search, ServerCog } from "lucide-react";
import { gsap } from "gsap";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

type CoverageDashboardProps = {
  initialRecords?: DeliveryRecord[];
};

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
  const shellRef = useRef<HTMLElement>(null);
  const caseScopeRef = useRef<HTMLDivElement>(null);
  const {
    records,
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
    refresh,
  } = useCoverageData({ initialRecords });

  const orderedProducts = useMemo(() => {
    const known = PRODUCT_ORDER.filter((product) => productOptions.includes(product));
    const rest = productOptions.filter((product) => !known.includes(product));
    return [...known, ...rest];
  }, [productOptions]);

  const metricMap = useMemo(() => getMetricMap(provinceMetrics), [provinceMetrics]);
  const productLabel = selectedProductTags[0] ?? "全部产品";
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
    () => (selectedProvince ? groupByCity(filteredRecords, selectedProvince) : []),
    [filteredRecords, selectedProvince],
  );
  const cityMetricMap = useMemo(() => getMetricMap(cityMetrics), [cityMetrics]);
  const mapMetrics = selectedProvince ? cityMetrics : provinceMetrics;
  const universityCards = useMemo(() => getUniversityCards(viewRecords), [viewRecords]);
  const selectedMetric = selectedProvince ? metricMap.get(selectedProvince) : undefined;
  const selectedCityMetric = selectedCity ? cityMetricMap.get(selectedCity) : undefined;
  const isEmpty = !loading && records.length === 0;
  const mapHeading = selectedProvince
    ? selectedCity
      ? `${selectedProvince} / ${selectedCity}覆盖详情`
      : `${selectedProvince}覆盖详情`
    : `${productLabel} 全国案例覆盖`;

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
    if (!caseScopeRef.current || prefersReducedMotion()) return;
    const context = gsap.context(() => {
      gsap.fromTo(
        "[data-case-card]",
        { opacity: 0, x: 22 },
        { opacity: 1, x: 0, duration: 0.38, stagger: 0.035, ease: "power2.out" },
      );
    }, caseScopeRef);
    return () => context.revert();
  }, [selectedCity, selectedProvince, selectedProductTags, keyword, universityCards.length]);

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
    setSelectedProvince(undefined);
    setSelectedCity(undefined);
  };

  const backToCountry = () => {
    setSelectedProvince(undefined);
    setSelectedCity(undefined);
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

      <section className="metric-ribbon" aria-label="覆盖摘要" data-hero-motion>
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

      <section className="coverage-workspace" data-hero-motion>
        <div className="map-console">
          <div className="console-heading">
            <div>
              <span>全国省份热力覆盖</span>
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

          <div className="map-stage">
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
                  {(selectedCity ? selectedCityMetric?.universityCount : selectedMetric?.universityCount) ?? 0} 所高校
                  / {(selectedCity ? selectedCityMetric?.deliveryCount : selectedMetric?.deliveryCount) ?? 0} 个案例
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
              <span>{selectedCity ?? selectedProvince ?? "全国"}高校案例</span>
              <h2>学校设备与业务痛点</h2>
            </div>
          </div>

          <div className="university-list">
            {universityCards.length === 0 && (
              <div className="empty-case-state">
                <strong>{isEmpty ? "暂无真实数据" : "当前筛选暂无高校案例"}</strong>
                <p>{isEmpty ? "请从首页导入 CSV，或进入录入页新增记录。" : "可调整产品、关键词或返回上一级区域。"}</p>
              </div>
            )}
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
