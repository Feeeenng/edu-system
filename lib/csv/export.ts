import Papa from "papaparse";
import { CSV_COLUMNS } from "@/lib/csv/schema";
import type { DeliveryPayload, DeliveryRecord } from "@/lib/types";

const CSV_TEMPLATE_SAMPLE: DeliveryPayload = {
  schoolId: "SCHOOL-440300-001",
  province: "广东省",
  city: "深圳市",
  university: "深圳大学",
  customerStatus: "重点客户",
  coverageStatus: "已下单",
  projectStage: "交付",
  deliveryDate: "2026-06-08",
  owner: "张三",
  purchaseTags: ["VMware替换", "信创"],
  productTags: ["SDDC", "EDS"],
  resourceType: "超融合资源",
  resourceAmount: 12,
  resourceUnit: "节点",
  deliveryContent: "SDDC资源池建设与EDS存储扩容",
  equipmentDetails: ["超融合节点x6", "EDS存储节点x3", "万兆交换机x2"],
  painPoints: ["VMware授权成本高", "科研数据增长快"],
  notes: "双一流底表可只填学校ID、省份、地区/城市、高校名称；采购过SDDC的学校填写产品标签SDDC",
  extraJson: { priority: "high" },
};

function formatValue(record: DeliveryPayload | DeliveryRecord, key: keyof DeliveryPayload) {
  const value = record[key];
  if (Array.isArray(value)) return value.join(";");
  if (key === "extraJson" && value && typeof value === "object") return JSON.stringify(value);
  return value ?? "";
}

export function buildCsvTemplate(): string {
  return Papa.unparse({
    fields: CSV_COLUMNS.map((column) => column.label),
    data: [CSV_COLUMNS.map((column) => formatValue(CSV_TEMPLATE_SAMPLE, column.key))],
  });
}

export function exportDeliveriesToCsv(records: Array<DeliveryPayload | DeliveryRecord>): string {
  return Papa.unparse({
    fields: CSV_COLUMNS.map((column) => column.label),
    data: records.map((record) => CSV_COLUMNS.map((column) => formatValue(record, column.key))),
  });
}
