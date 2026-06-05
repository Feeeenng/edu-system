import type { DeliveryPayload } from "@/lib/types";

export type CsvColumn = {
  key: keyof DeliveryPayload;
  label: string;
  aliases: string[];
};

export const CSV_COLUMNS: CsvColumn[] = [
  { key: "province", label: "省份", aliases: ["province"] },
  { key: "city", label: "地区/城市", aliases: ["城市", "地区", "city"] },
  { key: "university", label: "高校名称", aliases: ["高校", "学校", "university"] },
  { key: "longitude", label: "经度", aliases: ["longitude", "lng"] },
  { key: "latitude", label: "纬度", aliases: ["latitude", "lat"] },
  { key: "customerStatus", label: "客户状态", aliases: ["customerStatus"] },
  { key: "coverageStatus", label: "覆盖状态", aliases: ["coverageStatus"] },
  { key: "projectStage", label: "项目阶段", aliases: ["projectStage"] },
  { key: "deliveryDate", label: "交付日期", aliases: ["deliveryDate"] },
  { key: "owner", label: "负责人", aliases: ["owner"] },
  { key: "purchaseTags", label: "采购标签", aliases: ["purchaseTags"] },
  { key: "productTags", label: "产品标签", aliases: ["productTags"] },
  { key: "resourceType", label: "资源类型", aliases: ["resourceType"] },
  { key: "resourceAmount", label: "资源数量", aliases: ["resourceAmount"] },
  { key: "resourceUnit", label: "资源单位", aliases: ["resourceUnit"] },
  { key: "deliveryContent", label: "交付内容", aliases: ["deliveryContent"] },
  { key: "notes", label: "备注", aliases: ["notes"] },
  { key: "extraJson", label: "扩展字段JSON", aliases: ["extraJson"] },
];

export function resolveColumnKey(header: string): keyof DeliveryPayload | undefined {
  const normalized = header.trim();
  return CSV_COLUMNS.find((column) => column.label === normalized || column.aliases.includes(normalized))?.key;
}
