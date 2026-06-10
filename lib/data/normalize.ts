import type { DeliveryPayload, DeliveryRecord } from "@/lib/types";

function cleanText(value: string | undefined) {
  return value?.trim() ?? "";
}

const PROVINCE_NAME_ALIASES: Record<string, string> = {
  北京: "北京市",
  北京市: "北京市",
  天津: "天津市",
  天津市: "天津市",
  河北: "河北省",
  河北省: "河北省",
  山西: "山西省",
  山西省: "山西省",
  内蒙古: "内蒙古自治区",
  内蒙古自治区: "内蒙古自治区",
  辽宁: "辽宁省",
  辽宁省: "辽宁省",
  吉林: "吉林省",
  吉林省: "吉林省",
  黑龙江: "黑龙江省",
  黑龙江省: "黑龙江省",
  上海: "上海市",
  上海市: "上海市",
  江苏: "江苏省",
  江苏省: "江苏省",
  浙江: "浙江省",
  浙江省: "浙江省",
  安徽: "安徽省",
  安徽省: "安徽省",
  福建: "福建省",
  福建省: "福建省",
  江西: "江西省",
  江西省: "江西省",
  山东: "山东省",
  山东省: "山东省",
  河南: "河南省",
  河南省: "河南省",
  湖北: "湖北省",
  湖北省: "湖北省",
  湖南: "湖南省",
  湖南省: "湖南省",
  广东: "广东省",
  广东省: "广东省",
  广西: "广西壮族自治区",
  广西壮族自治区: "广西壮族自治区",
  海南: "海南省",
  海南省: "海南省",
  重庆: "重庆市",
  重庆市: "重庆市",
  四川: "四川省",
  四川省: "四川省",
  贵州: "贵州省",
  贵州省: "贵州省",
  云南: "云南省",
  云南省: "云南省",
  西藏: "西藏自治区",
  西藏自治区: "西藏自治区",
  陕西: "陕西省",
  陕西省: "陕西省",
  甘肃: "甘肃省",
  甘肃省: "甘肃省",
  青海: "青海省",
  青海省: "青海省",
  宁夏: "宁夏回族自治区",
  宁夏回族自治区: "宁夏回族自治区",
  新疆: "新疆维吾尔自治区",
  新疆维吾尔自治区: "新疆维吾尔自治区",
  香港: "香港特别行政区",
  香港特别行政区: "香港特别行政区",
  澳门: "澳门特别行政区",
  澳门特别行政区: "澳门特别行政区",
  台湾: "台湾省",
  台湾省: "台湾省",
};

export function normalizeProvinceName(value: string | undefined) {
  const cleaned = cleanText(value).replace(/[\s\u200b-\u200f\ufeff]/g, "");
  return PROVINCE_NAME_ALIASES[cleaned] ?? cleaned;
}

function cleanOptionalText(value: string | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

function cleanTags(value: string[] | undefined) {
  return Array.from(new Set((value ?? []).map((item) => item.trim()).filter(Boolean)));
}

function cleanNumber(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function normalizeDeliveryPayload(payload: DeliveryPayload): DeliveryPayload {
  return {
    ...payload,
    schoolId: cleanOptionalText(payload.schoolId),
    province: normalizeProvinceName(payload.province),
    city: cleanText(payload.city),
    university: cleanText(payload.university),
    longitude: cleanNumber(payload.longitude),
    latitude: cleanNumber(payload.latitude),
    customerStatus: cleanOptionalText(payload.customerStatus),
    coverageStatus: cleanOptionalText(payload.coverageStatus) as DeliveryPayload["coverageStatus"],
    projectStage: cleanOptionalText(payload.projectStage) as DeliveryPayload["projectStage"],
    deliveryDate: cleanOptionalText(payload.deliveryDate),
    owner: cleanOptionalText(payload.owner),
    purchaseYear: cleanOptionalText(payload.purchaseYear),
    purchaseTags: cleanTags(payload.purchaseTags),
    productTags: cleanTags(payload.productTags),
    provinceUniversityTotal: cleanNumber(payload.provinceUniversityTotal),
    cityUniversityTotal: cleanNumber(payload.cityUniversityTotal),
    resourceType: cleanOptionalText(payload.resourceType),
    resourceAmount: cleanNumber(payload.resourceAmount),
    resourceUnit: cleanOptionalText(payload.resourceUnit),
    businessScenario: cleanOptionalText(payload.businessScenario),
    coreValue: cleanOptionalText(payload.coreValue),
    deviceModel: cleanOptionalText(payload.deviceModel),
    bidLink: cleanOptionalText(payload.bidLink),
    deliveryContent: cleanOptionalText(payload.deliveryContent),
    equipmentDetails: cleanTags(payload.equipmentDetails),
    painPoints: cleanTags(payload.painPoints),
    notes: cleanOptionalText(payload.notes),
    extraJson: payload.extraJson,
  };
}

export function createDeliveryRecord(payload: DeliveryPayload): DeliveryRecord {
  const normalized = normalizeDeliveryPayload(payload);
  return {
    ...normalized,
    id: normalized.id ?? `delivery-${crypto.randomUUID()}`,
    updatedAt: cleanOptionalText(normalized.updatedAt) ?? new Date().toISOString(),
  };
}
