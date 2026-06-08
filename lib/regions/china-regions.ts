type RegionFeature = {
  properties?: {
    name?: string;
  };
};

type RegionJson = {
  features?: RegionFeature[];
};

type RegionJsonModule = {
  default: RegionJson;
};

type ChinaRegionSource = {
  name: string;
  loader?: () => Promise<RegionJsonModule>;
  cities?: string[];
};

const REGION_SOURCES: ChinaRegionSource[] = [
  { name: "北京市", loader: () => import("china-map-echarts/map/110000.json") },
  { name: "天津市", loader: () => import("china-map-echarts/map/120000.json") },
  { name: "河北省", loader: () => import("china-map-echarts/map/130000.json") },
  { name: "山西省", loader: () => import("china-map-echarts/map/140000.json") },
  { name: "内蒙古自治区", loader: () => import("china-map-echarts/map/150000.json") },
  { name: "辽宁省", loader: () => import("china-map-echarts/map/210000.json") },
  { name: "吉林省", loader: () => import("china-map-echarts/map/220000.json") },
  { name: "黑龙江省", loader: () => import("china-map-echarts/map/230000.json") },
  { name: "上海市", loader: () => import("china-map-echarts/map/310000.json") },
  { name: "江苏省", loader: () => import("china-map-echarts/map/320000.json") },
  { name: "浙江省", loader: () => import("china-map-echarts/map/330000.json") },
  { name: "安徽省", loader: () => import("china-map-echarts/map/340000.json") },
  { name: "福建省", loader: () => import("china-map-echarts/map/350000.json") },
  { name: "江西省", loader: () => import("china-map-echarts/map/360000.json") },
  { name: "山东省", loader: () => import("china-map-echarts/map/370000.json") },
  { name: "河南省", loader: () => import("china-map-echarts/map/410000.json") },
  { name: "湖北省", loader: () => import("china-map-echarts/map/420000.json") },
  { name: "湖南省", loader: () => import("china-map-echarts/map/430000.json") },
  { name: "广东省", loader: () => import("china-map-echarts/map/440000.json") },
  { name: "广西壮族自治区", loader: () => import("china-map-echarts/map/450000.json") },
  { name: "海南省", loader: () => import("china-map-echarts/map/460000.json") },
  { name: "重庆市", loader: () => import("china-map-echarts/map/500000.json") },
  { name: "四川省", loader: () => import("china-map-echarts/map/510000.json") },
  { name: "贵州省", loader: () => import("china-map-echarts/map/520000.json") },
  { name: "云南省", loader: () => import("china-map-echarts/map/530000.json") },
  { name: "西藏自治区", loader: () => import("china-map-echarts/map/540000.json") },
  { name: "陕西省", loader: () => import("china-map-echarts/map/610000.json") },
  { name: "甘肃省", loader: () => import("china-map-echarts/map/620000.json") },
  { name: "青海省", loader: () => import("china-map-echarts/map/630000.json") },
  { name: "宁夏回族自治区", loader: () => import("china-map-echarts/map/640000.json") },
  { name: "新疆维吾尔自治区", loader: () => import("china-map-echarts/map/650000.json") },
  // 依赖包没有台湾省下级 GeoJSON，录入时保留省级选项，避免用户无法选择。
  { name: "台湾省", cities: ["台湾省"] },
  { name: "香港特别行政区", loader: () => import("china-map-echarts/map/810000.json") },
  { name: "澳门特别行政区", loader: () => import("china-map-echarts/map/820000.json") },
];

const cityCache = new Map<string, string[]>();

function getFeatureNames(region: RegionJson) {
  return (region.features ?? [])
    .map((feature) => feature.properties?.name?.trim())
    .filter((name): name is string => Boolean(name));
}

export function getProvinceOptions() {
  return REGION_SOURCES.map((region) => region.name);
}

export async function getCityOptions(province: string) {
  if (!province) return [];
  const cached = cityCache.get(province);
  if (cached) return cached;

  const region = REGION_SOURCES.find((item) => item.name === province);
  if (!region) return [];

  const cities = region.cities ?? (region.loader ? getFeatureNames((await region.loader()).default) : [province]);
  cityCache.set(province, cities);
  return cities;
}
