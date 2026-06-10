"use client";

import * as echarts from "echarts";
import chinaGeoJson from "china-map-echarts/map/100000.json";
import { useEffect, useMemo, useRef } from "react";
import type {
  DefaultLabelFormatterCallbackParams,
  ECharts,
  EChartsOption,
  PiecewiseVisualMapComponentOption,
  TooltipComponentFormatterCallbackParams,
} from "echarts";
import type { RegionMetric } from "@/lib/types";

const MAP_NAME = "edu-china";
const REGISTERED_MAPS = new Set<string>();
type GeoLabelFormatterParams = { name?: string };
type MapLayout = {
  center: [string, string];
  size: string;
  aspectScale: number;
  labelFontSize: number;
  showLabel: boolean;
  boundingCoords?: [[number, number], [number, number]];
};

const SHORT_REGION_NAMES: Record<string, string> = {
  北京市: "北京",
  天津市: "天津",
  上海市: "上海",
  重庆市: "重庆",
  内蒙古自治区: "内蒙古",
  广西壮族自治区: "广西",
  西藏自治区: "西藏",
  宁夏回族自治区: "宁夏",
  新疆维吾尔自治区: "新疆",
  香港特别行政区: "香港",
  澳门特别行政区: "澳门",
  黑龙江省: "黑龙江",
  广东省: "广东",
  海南省: "海南",
  台湾省: "台湾",
};

type ChinaCoverageMapProps = {
  metrics: RegionMetric[];
  selectedProvince?: string;
  onSelectProvince(province: string): void;
};

function registerChinaMap() {
  if (REGISTERED_MAPS.has(MAP_NAME)) return;
  echarts.registerMap(MAP_NAME, chinaGeoJson as Parameters<typeof echarts.registerMap>[1]);
  REGISTERED_MAPS.add(MAP_NAME);
}

function shouldSkipEchartsRuntime() {
  // JSDOM 没有真实 canvas 绘制上下文，单元测试只验证可访问结构和交互状态。
  return process.env.NODE_ENV === "test";
}

function getMaxDeliveryCount(metrics: RegionMetric[]) {
  return Math.max(1, ...metrics.map((metric) => metric.deliveryCount));
}

function getMetricValue(metric: RegionMetric, useCoverageRate: boolean) {
  if (!useCoverageRate) return metric.deliveryCount;
  return metric.coverageRate !== undefined ? Math.round(metric.coverageRate * 1000) / 10 : 0;
}

function buildVisualMapPieces(useCoverageRate: boolean): PiecewiseVisualMapComponentOption["pieces"] {
  // 低数据量筛选时使用分段色阶，避免连续浅色渐变让少量覆盖区域不可见。
  if (useCoverageRate) {
    return [
      { gte: 50, label: ">= 50%", color: "#16a34a" },
      { gte: 35, lt: 50, label: "35% - 50%", color: "#86efac" },
      { gte: 20, lt: 35, label: "20% - 35%", color: "#fb923c" },
      { gte: 10, lt: 20, label: "10% - 20%", color: "#facc15" },
      { gte: 5, lt: 10, label: "5% - 10%", color: "#fde68a" },
      { gt: 0, lt: 5, label: "0% - 5%", color: "#ef4444" },
      { value: 0, label: "0% / 未覆盖", color: "#d1d5db" },
    ];
  }

  return [
    { value: 0, label: "无数据", color: "#d1d5db" },
    { gt: 0, lte: 1, label: "1", color: "#38bdf8" },
    { gt: 1, lte: 3, label: "2 - 3", color: "#2563eb" },
    { gt: 3, lte: 6, label: "4 - 6", color: "#1d4ed8" },
    { gt: 6, label: "> 6", color: "#0f172a" },
  ];
}

function getMapLayout(mapName: string): MapLayout {
  return {
    center: mapName === MAP_NAME ? ["50%", "52%"] : ["50%", "52%"],
    size: mapName === MAP_NAME ? "104%" : "104%",
    aspectScale: 0.82,
    labelFontSize: 10,
    showLabel: true,
  };
}

function buildVisualMapOption(useCoverageRate: boolean, maxDeliveryCount: number): PiecewiseVisualMapComponentOption {
  if (useCoverageRate) {
    return {
      type: "piecewise",
      show: true,
      left: 18,
      bottom: 18,
      orient: "vertical",
      itemWidth: 13,
      itemHeight: 13,
      itemGap: 7,
      textStyle: { color: "#475569", fontSize: 11 },
      pieces: buildVisualMapPieces(true),
      outOfRange: { color: "#d1d5db" },
    };
  }

  return {
    type: "piecewise",
    show: true,
    min: 0,
    max: maxDeliveryCount,
    left: 18,
    bottom: 18,
    orient: "vertical",
    itemWidth: 13,
    itemHeight: 13,
    itemGap: 7,
    textStyle: { color: "#475569", fontSize: 11 },
    pieces: buildVisualMapPieces(false),
    outOfRange: { color: "#e2e8f0" },
  };
}

function getRegionLabel(name?: string) {
  if (!name) return "";
  return SHORT_REGION_NAMES[name] ?? name.replace(/省$|市$|地区$|盟$|自治州$|回族自治区$|维吾尔自治区$|壮族自治区$|特别行政区$/u, "");
}

function formatCoverage(metric: RegionMetric) {
  if (!metric.totalUniversityCount) return `${metric.universityCount} / -`;
  return `${metric.universityCount} / ${metric.totalUniversityCount}`;
}

function formatCoverageRate(metric: RegionMetric) {
  return metric.coverageRate !== undefined ? `${Math.round(metric.coverageRate * 1000) / 10}%` : "-";
}

function getTooltipName(params: TooltipComponentFormatterCallbackParams) {
  const item: DefaultLabelFormatterCallbackParams | undefined = Array.isArray(params) ? params[0] : params;
  return typeof item?.name === "string" ? item.name : "";
}

function buildMapOption(metrics: RegionMetric[], mapName: string, selectedRegion?: string): EChartsOption {
  const hasRate = metrics.some((metric) => metric.coverageRate !== undefined);
  const maxDeliveryCount = hasRate ? 100 : getMaxDeliveryCount(metrics);
  const mapLayout = getMapLayout(mapName);
  return {
    backgroundColor: "transparent",
    animation: true,
    animationDuration: 1100,
    animationDurationUpdate: 720,
    animationEasing: "cubicOut",
    animationEasingUpdate: "quarticOut",
    tooltip: {
      trigger: "item",
      borderWidth: 0,
      backgroundColor: "rgba(15, 23, 42, 0.88)",
      textStyle: { color: "#ffffff" },
      formatter: (params) => {
        const name = getTooltipName(params);
        const metric = metrics.find((item) => item.name === name);
        if (!metric) return `${name}<br/>暂无案例`;
        return [
          metric.name,
          `覆盖数：${formatCoverage(metric)}`,
          `覆盖率：${formatCoverageRate(metric)}`,
          `交付案例：${metric.deliveryCount}`,
        ].join("<br/>");
      },
    },
    visualMap: buildVisualMapOption(hasRate, maxDeliveryCount),
    geo: {
      map: mapName,
      roam: false,
      layoutCenter: mapLayout.center,
      layoutSize: mapLayout.size,
      aspectScale: mapLayout.aspectScale,
      boundingCoords: mapLayout.boundingCoords,
      label: {
        show: mapLayout.showLabel,
        color: "#334155",
        fontSize: mapLayout.labelFontSize,
        formatter: (params: GeoLabelFormatterParams) => getRegionLabel(params.name),
        overflow: "truncate",
      },
      itemStyle: {
        borderColor: "#ffffff",
        borderWidth: 1.2,
        areaColor: "#d1d5db",
      },
      emphasis: {
        label: { show: true, color: "#0f172a", fontWeight: 700 },
        itemStyle: { areaColor: "#f59e0b" },
      },
      select: {
        label: { show: true, color: "#0f172a", fontWeight: 800 },
        itemStyle: { areaColor: "#fbbf24" },
      },
      selectedMode: "single",
      regions: selectedRegion
        ? [
            {
              name: selectedRegion,
              selected: true,
              itemStyle: { areaColor: "#fbbf24", borderColor: "#0f172a", borderWidth: 1.4 },
            },
          ]
        : [],
    },
    series: [
      {
        name: "高校案例覆盖",
        type: "map",
        map: mapName,
        geoIndex: 0,
        selectedMode: "single",
        animationDelay: (index) => index * 18,
        animationDurationUpdate: 760,
        animationDelayUpdate: (index) => index * 8,
        data: metrics.map((metric) => ({
          name: metric.name,
          value: getMetricValue(metric, hasRate),
          universityCount: metric.universityCount,
          totalUniversityCount: metric.totalUniversityCount,
          coverageRate: metric.coverageRate,
        })),
      },
    ],
  };
}

export function ChinaCoverageMap({
  metrics,
  selectedProvince,
  onSelectProvince,
}: ChinaCoverageMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);
  const mapName = MAP_NAME;
  const selectedRegion = selectedProvince;
  const option = useMemo(() => buildMapOption(metrics, mapName, selectedRegion), [mapName, metrics, selectedRegion]);
  const optionRef = useRef(option);
  const clickHandlerRef = useRef<(name: string) => void>(() => undefined);

  useEffect(() => {
    optionRef.current = option;
  }, [option]);

  useEffect(() => {
    clickHandlerRef.current = (name: string) => {
      onSelectProvince(name);
    };
  }, [onSelectProvince]);

  useEffect(() => {
    if (!containerRef.current || shouldSkipEchartsRuntime()) return;
    let disposed = false;

    const setupChart = async () => {
      registerChinaMap();
      if (disposed || !containerRef.current) return;

      const chart = echarts.init(containerRef.current, undefined, { renderer: "canvas" });
      chartRef.current = chart;
      chart.setOption(optionRef.current, true);
      chart.resize();
      chart.on("click", (params) => {
        if (typeof params.name === "string") clickHandlerRef.current(params.name);
      });
    };

    void setupChart();

    const resize = () => {
      chartRef.current?.resize();
      chartRef.current?.setOption(optionRef.current, true);
    };
    const observer =
      typeof ResizeObserver === "undefined" || !containerRef.current
        ? undefined
        : new ResizeObserver(() => {
            resize();
          });
    observer?.observe(containerRef.current);
    window.addEventListener("resize", resize);
    return () => {
      disposed = true;
      window.removeEventListener("resize", resize);
      observer?.disconnect();
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (shouldSkipEchartsRuntime()) return;
    registerChinaMap();
    chartRef.current?.setOption(option, true);
    chartRef.current?.resize();
  }, [option]);

  return (
    <div className="echarts-map-shell" role="img" aria-label="ECharts 中国高校覆盖地图">
      <span className="map-scanline" aria-hidden="true" />
      <div className="echarts-map-canvas" ref={containerRef} aria-hidden="true" />
      <div className="south-china-sea-inset" aria-hidden="true">
        <span>南海诸岛</span>
        <i className="island island-one" />
        <i className="island island-two" />
        <i className="island island-three" />
        <i className="island island-four" />
        <i className="island island-five" />
        <i className="island island-six" />
        <i className="sea-dash dash-one" />
        <i className="sea-dash dash-two" />
        <i className="sea-dash dash-three" />
        <i className="sea-dash dash-four" />
      </div>
    </div>
  );
}
