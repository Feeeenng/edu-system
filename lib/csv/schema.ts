import type { DeliveryPayload } from "@/lib/types";

export type CsvColumn = {
  key: keyof DeliveryPayload;
  label: string;
  aliases: string[];
};

export const CSV_COLUMNS: CsvColumn[] = [
  { key: "schoolId", label: "学校ID", aliases: ["高校ID", "学校编号", "高校编号", "schoolId"] },
  { key: "province", label: "省份", aliases: ["province"] },
  { key: "city", label: "地区/城市", aliases: ["城市", "地区", "city"] },
  { key: "university", label: "高校名称", aliases: ["高校", "学校", "university"] },
  { key: "customerStatus", label: "客户状态", aliases: ["customerStatus"] },
  { key: "coverageStatus", label: "覆盖状态", aliases: ["coverageStatus"] },
  { key: "projectStage", label: "项目阶段", aliases: ["projectStage"] },
  { key: "deliveryDate", label: "交付日期", aliases: ["deliveryDate"] },
  { key: "owner", label: "负责人", aliases: ["owner"] },
  { key: "purchaseTags", label: "采购标签", aliases: ["purchaseTags"] },
  { key: "productTags", label: "产品标签", aliases: ["productTags"] },
  { key: "provinceUniversityTotal", label: "省份高校总数", aliases: ["省高校总数", "provinceUniversityTotal"] },
  { key: "cityUniversityTotal", label: "城市高校总数", aliases: ["市高校总数", "cityUniversityTotal"] },
  { key: "resourceType", label: "资源类型", aliases: ["resourceType"] },
  { key: "resourceAmount", label: "资源数量", aliases: ["resourceAmount"] },
  { key: "resourceUnit", label: "资源单位", aliases: ["resourceUnit"] },
  { key: "deliveryContent", label: "交付内容", aliases: ["deliveryContent"] },
  { key: "equipmentDetails", label: "设备明细", aliases: ["设备", "采购设备", "equipmentDetails"] },
  { key: "painPoints", label: "业务痛点", aliases: ["痛点", "painPoints"] },
  { key: "notes", label: "备注", aliases: ["notes"] },
  { key: "extraJson", label: "扩展字段JSON", aliases: ["extraJson"] },
];

const IGNORED_COLUMN_HEADERS = new Set(["经度", "纬度", "longitude", "lng", "latitude", "lat"]);

export function resolveColumnKey(header: string): keyof DeliveryPayload | undefined {
  const normalized = header.trim();
  if (IGNORED_COLUMN_HEADERS.has(normalized)) return undefined;
  return CSV_COLUMNS.find((column) => column.label === normalized || column.aliases.includes(normalized))?.key;
}
