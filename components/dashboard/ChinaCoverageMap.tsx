"use client";

import * as echarts from "echarts";
import chinaGeoJson from "china-map-echarts/map/100000.json";
import { useEffect, useMemo, useRef } from "react";
import type {
  DefaultLabelFormatterCallbackParams,
  ECharts,
  EChartsOption,
  TooltipComponentFormatterCallbackParams,
} from "echarts";
import type { RegionMetric } from "@/lib/types";

const MAP_NAME = "edu-china";
const REGISTERED_MAPS = new Set<string>();
type MapJsonModule = { default: unknown };

const PROVINCE_MAP_LOADERS: Record<string, () => Promise<MapJsonModule>> = {
  北京市: () => import("china-map-echarts/map/110000.json"),
  天津市: () => import("china-map-echarts/map/120000.json"),
  河北省: () => import("china-map-echarts/map/130000.json"),
  山西省: () => import("china-map-echarts/map/140000.json"),
  内蒙古自治区: () => import("china-map-echarts/map/150000.json"),
  辽宁省: () => import("china-map-echarts/map/210000.json"),
  吉林省: () => import("china-map-echarts/map/220000.json"),
  黑龙江省: () => import("china-map-echarts/map/230000.json"),
  上海市: () => import("china-map-echarts/map/310000.json"),
  江苏省: () => import("china-map-echarts/map/320000.json"),
  浙江省: () => import("china-map-echarts/map/330000.json"),
  安徽省: () => import("china-map-echarts/map/340000.json"),
  福建省: () => import("china-map-echarts/map/350000.json"),
  江西省: () => import("china-map-echarts/map/360000.json"),
  山东省: () => import("china-map-echarts/map/370000.json"),
  河南省: () => import("china-map-echarts/map/410000.json"),
  湖北省: () => import("china-map-echarts/map/420000.json"),
  湖南省: () => import("china-map-echarts/map/430000.json"),
  广东省: () => import("china-map-echarts/map/440000.json"),
  广西壮族自治区: () => import("china-map-echarts/map/450000.json"),
  海南省: () => import("china-map-echarts/map/460000.json"),
  重庆市: () => import("china-map-echarts/map/500000.json"),
  四川省: () => import("china-map-echarts/map/510000.json"),
  贵州省: () => import("china-map-echarts/map/520000.json"),
  云南省: () => import("china-map-echarts/map/530000.json"),
  西藏自治区: () => import("china-map-echarts/map/540000.json"),
  陕西省: () => import("china-map-echarts/map/610000.json"),
  甘肃省: () => import("china-map-echarts/map/620000.json"),
  青海省: () => import("china-map-echarts/map/630000.json"),
  宁夏回族自治区: () => import("china-map-echarts/map/640000.json"),
  新疆维吾尔自治区: () => import("china-map-echarts/map/650000.json"),
  香港特别行政区: () => import("china-map-echarts/map/810000.json"),
  澳门特别行政区: () => import("china-map-echarts/map/820000.json"),
};

type ChinaCoverageMapProps = {
  metrics: RegionMetric[];
  selectedProvince?: string;
  selectedCity?: string;
  onSelectProvince(province: string): void;
  onSelectCity(city: string): void;
};

function registerChinaMap() {
  if (REGISTERED_MAPS.has(MAP_NAME)) return;
  echarts.registerMap(MAP_NAME, chinaGeoJson as Parameters<typeof echarts.registerMap>[1]);
  REGISTERED_MAPS.add(MAP_NAME);
}

function getProvinceMapName(province: string) {
  return `edu-province-${province}`;
}

async function registerProvinceMap(province: string) {
  const mapName = getProvinceMapName(province);
  if (REGISTERED_MAPS.has(mapName)) return mapName;

  const loader = PROVINCE_MAP_LOADERS[province];
  if (!loader) return MAP_NAME;

  const geoJson = await loader();
  echarts.registerMap(mapName, geoJson.default as Parameters<typeof echarts.registerMap>[1]);
  REGISTERED_MAPS.add(mapName);
  return mapName;
}

function getRenderableMapName(province?: string) {
  if (!province) return MAP_NAME;
  const mapName = getProvinceMapName(province);
  return REGISTERED_MAPS.has(mapName) ? mapName : MAP_NAME;
}

function shouldSkipEchartsRuntime() {
  // JSDOM 没有真实 canvas 绘制上下文，单元测试只验证可访问结构和交互状态。
  return process.env.NODE_ENV === "test";
}

function getMaxDeliveryCount(metrics: RegionMetric[]) {
  return Math.max(1, ...metrics.map((metric) => metric.deliveryCount));
}

function getTooltipName(params: TooltipComponentFormatterCallbackParams) {
  const item: DefaultLabelFormatterCallbackParams | undefined = Array.isArray(params) ? params[0] : params;
  return typeof item?.name === "string" ? item.name : "";
}

function buildMapOption(metrics: RegionMetric[], mapName: string, selectedRegion?: string): EChartsOption {
  const maxDeliveryCount = getMaxDeliveryCount(metrics);
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
        return `${metric.name}<br/>覆盖高校：${metric.universityCount}<br/>交付案例：${metric.deliveryCount}`;
      },
    },
    visualMap: {
      show: true,
      min: 0,
      max: maxDeliveryCount,
      left: 18,
      bottom: 22,
      text: ["高", "低"],
      itemWidth: 10,
      itemHeight: 70,
      textStyle: { color: "#475569", fontSize: 11 },
      inRange: { color: ["#dbeafe", "#38bdf8", "#2563eb"] },
    },
    geo: {
      map: mapName,
      roam: false,
      zoom: mapName === MAP_NAME ? 1.12 : 1,
      top: 28,
      bottom: 34,
      label: {
        show: true,
        color: "#334155",
        fontSize: 11,
      },
      itemStyle: {
        borderColor: "#ffffff",
        borderWidth: 1,
        areaColor: "#e2e8f0",
      },
      emphasis: {
        label: { color: "#0f172a", fontWeight: 700 },
        itemStyle: { areaColor: "#f59e0b" },
      },
      select: {
        label: { color: "#0f172a", fontWeight: 800 },
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
          value: metric.deliveryCount,
          universityCount: metric.universityCount,
        })),
      },
    ],
  };
}

export function ChinaCoverageMap({
  metrics,
  selectedProvince,
  selectedCity,
  onSelectProvince,
  onSelectCity,
}: ChinaCoverageMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);
  const mapName = getRenderableMapName(selectedProvince);
  const selectedRegion = selectedProvince ? selectedCity : selectedProvince;
  const option = useMemo(() => buildMapOption(metrics, mapName, selectedRegion), [mapName, metrics, selectedRegion]);
  const optionRef = useRef(option);
  const clickHandlerRef = useRef<(name: string) => void>(() => undefined);
  const mapTitle = selectedProvince ?? "中国";
  const listLabel = selectedProvince ? "城市覆盖列表" : "省份覆盖列表";
  const activeRegion = selectedProvince ? selectedCity : selectedProvince;

  useEffect(() => {
    optionRef.current = option;
  }, [option]);

  useEffect(() => {
    clickHandlerRef.current = (name: string) => {
      if (selectedProvince) {
        onSelectCity(name);
        return;
      }

      onSelectProvince(name);
    };
  }, [onSelectCity, onSelectProvince, selectedProvince]);

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
    window.addEventListener("resize", resize);
    return () => {
      disposed = true;
      window.removeEventListener("resize", resize);
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (shouldSkipEchartsRuntime()) return;
    let disposed = false;

    const updateMap = async () => {
      registerChinaMap();
      if (selectedProvince) {
        await registerProvinceMap(selectedProvince);
      }
      if (!disposed) {
        const nextMapName = getRenderableMapName(selectedProvince);
        chartRef.current?.setOption(buildMapOption(metrics, nextMapName, selectedRegion), true);
        chartRef.current?.resize();
      }
    };

    void updateMap();
    return () => {
      disposed = true;
    };
  }, [metrics, option, selectedProvince, selectedRegion]);

  return (
    <div className="echarts-map-shell" role="img" aria-label="ECharts 中国高校覆盖地图">
      <span className="map-engine-label">ECharts {mapTitle}地图</span>
      <span className="map-scanline" aria-hidden="true" />
      <span className="map-pulse-dot dot-north" aria-hidden="true" />
      <span className="map-pulse-dot dot-east" aria-hidden="true" />
      <span className="map-pulse-dot dot-south" aria-hidden="true" />
      <div className="echarts-map-canvas" ref={containerRef} aria-hidden="true" />
      <div className="map-access-list" aria-label={listLabel}>
        {metrics.map((metric) => (
          <button
            className={metric.name === activeRegion ? "province-access is-active" : "province-access"}
            key={metric.name}
            type="button"
            onClick={() => clickHandlerRef.current(metric.name)}
          >
            {metric.name}
            <small>{metric.universityCount} 所 / {metric.deliveryCount} 案例</small>
          </button>
        ))}
      </div>
    </div>
  );
}
