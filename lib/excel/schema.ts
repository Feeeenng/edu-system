import type { DeliveryPayload } from "@/lib/types";

export type ExcelColumn = {
  key: keyof DeliveryPayload;
  label: string;
  aliases: string[];
  width: number;
};

export const EXCEL_SHEET_NAME = "高校交付记录";
export const EXCEL_TEMPLATE_PATH = "data/高校信息维护清单-模板.xlsx";

export const EXCEL_COLUMNS: ExcelColumn[] = [
  { key: "schoolId", label: "学校ID", aliases: ["高校ID", "学校编号", "高校编号", "schoolId"], width: 10 },
  { key: "province", label: "省份", aliases: ["province"], width: 15 },
  { key: "university", label: "高校名称", aliases: ["高校", "学校", "university"], width: 22 },
  { key: "coverageStatus", label: "覆盖状态", aliases: ["coverageStatus"], width: 14 },
  { key: "customerStatus", label: "客户现状", aliases: ["客户状态", "customerStatus"], width: 40 },
  { key: "purchaseYear", label: "采购时间（年份）", aliases: ["采购时间", "采购年份", "purchaseYear"], width: 16 },
  {
    key: "purchaseTags",
    label: "产品标签（信创/VMware/二级学院/其他部门）",
    aliases: ["采购标签", "产品标签", "purchaseTags"],
    width: 52,
  },
  {
    key: "resourceType",
    label: "资源类型（SDDC/EDS/aDesk/AIBuilder）",
    aliases: ["资源类型", "产品类型", "resourceType"],
    width: 46,
  },
  { key: "resourceAmount", label: "资源规模", aliases: ["资源数量", "resourceAmount"], width: 18 },
  { key: "resourceUnit", label: "资源单位（C/TB/终端数/套）", aliases: ["资源单位", "resourceUnit"], width: 34 },
  { key: "businessScenario", label: "业务场景", aliases: ["场景", "businessScenario"], width: 18 },
  { key: "coreValue", label: "核心价值点", aliases: ["价值点", "业务痛点", "coreValue"], width: 32 },
  { key: "deviceModel", label: "设备型号", aliases: ["设备明细", "设备", "deviceModel"], width: 18 },
  { key: "bidLink", label: "中标链接", aliases: ["链接", "bidLink"], width: 20 },
  { key: "notes", label: "备注", aliases: ["notes"], width: 20 },
  { key: "extraJson", label: "扩展字段JSON", aliases: ["extraJson"], width: 18 },
];

const IGNORED_COLUMN_HEADERS = new Set(["经度", "纬度", "longitude", "lng", "latitude", "lat"]);

export function resolveExcelColumnKey(header: string): keyof DeliveryPayload | undefined {
  const normalized = header.trim();
  if (IGNORED_COLUMN_HEADERS.has(normalized)) return undefined;
  return EXCEL_COLUMNS.find((column) => column.label === normalized || column.aliases.includes(normalized))?.key;
}
