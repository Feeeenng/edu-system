import { describe, expect, it } from "vitest";
import { buildCsvTemplate, exportDeliveriesToCsv } from "@/lib/csv/export";
import { parseDeliveryCsv } from "@/lib/csv/parse";
import { CSV_COLUMNS } from "@/lib/csv/schema";
import { mockDeliveries } from "@/lib/mock/deliveries";

describe("csv", () => {
  it("提供中文 CSV 模板表头", () => {
    const template = buildCsvTemplate();

    expect(template).toContain("省份");
    expect(template).toContain("高校名称");
    expect(template).toContain("产品标签");
    expect(CSV_COLUMNS.some((column) => column.key === "province" && column.label === "省份")).toBe(true);
  });

  it("解析中文列名并拆分标签", () => {
    const csv = [
      "省份,地区/城市,高校名称,采购标签,产品标签,资源数量,交付内容",
      "广东省,深圳市,深圳大学,VMware替换;信创,SDDC;EDS,12,测试导入",
    ].join("\n");

    const result = parseDeliveryCsv(csv);

    expect(result.errors).toEqual([]);
    expect(result.records[0].province).toBe("广东省");
    expect(result.records[0].purchaseTags).toEqual(["VMware替换", "信创"]);
    expect(result.records[0].productTags).toEqual(["SDDC", "EDS"]);
    expect(result.records[0].resourceAmount).toBe(12);
  });

  it("返回缺少必填字段的行号错误", () => {
    const csv = ["省份,地区/城市,高校名称", "广东省,深圳市,"].join("\n");
    const result = parseDeliveryCsv(csv);

    expect(result.records).toHaveLength(0);
    expect(result.errors[0]).toContain("第 2 行");
    expect(result.errors[0]).toContain("高校名称");
  });

  it("导出交付记录为 CSV", () => {
    const csv = exportDeliveriesToCsv(mockDeliveries.slice(0, 1));

    expect(csv).toContain("省份");
    expect(csv).toContain("清华大学");
    expect(csv).toContain("FastGPT;EDS");
  });
});
