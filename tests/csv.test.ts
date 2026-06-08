import { describe, expect, it } from "vitest";
import { buildCsvTemplate, exportDeliveriesToCsv } from "@/lib/csv/export";
import { parseDeliveryCsv } from "@/lib/csv/parse";
import { CSV_COLUMNS } from "@/lib/csv/schema";
import { sampleDeliveries } from "@/tests/fixtures/deliveries";

describe("csv", () => {
  it("提供中文 CSV 模板表头", () => {
    const template = buildCsvTemplate();

    expect(template).toContain("省份");
    expect(template).toContain("高校名称");
    expect(template).toContain("产品标签");
    expect(template).not.toContain("经度");
    expect(template).not.toContain("纬度");
    expect(CSV_COLUMNS.some((column) => column.key === "province" && column.label === "省份")).toBe(true);
    expect(CSV_COLUMNS.some((column) => column.key === "longitude" || column.key === "latitude")).toBe(false);
  });

  it("解析中文列名并拆分标签", () => {
    const csv = [
      "省份,地区/城市,高校名称,采购标签,产品标签,资源数量,交付内容,设备明细,业务痛点",
      "广东省,深圳市,深圳大学,VMware替换;信创,SDDC;EDS,12,测试导入,超融合节点x6；存储交换机x2,VMware授权成本高；实验室资源申请慢",
    ].join("\n");

    const result = parseDeliveryCsv(csv);

    expect(result.errors).toEqual([]);
    expect(result.records[0].province).toBe("广东省");
    expect(result.records[0].purchaseTags).toEqual(["VMware替换", "信创"]);
    expect(result.records[0].productTags).toEqual(["SDDC", "EDS"]);
    expect(result.records[0].resourceAmount).toBe(12);
    expect(result.records[0].equipmentDetails).toEqual(["超融合节点x6", "存储交换机x2"]);
    expect(result.records[0].painPoints).toEqual(["VMware授权成本高", "实验室资源申请慢"]);
  });

  it("返回缺少必填字段的行号错误", () => {
    const csv = ["省份,地区/城市,高校名称", "广东省,深圳市,"].join("\n");
    const result = parseDeliveryCsv(csv);

    expect(result.records).toHaveLength(0);
    expect(result.errors[0]).toContain("第 2 行");
    expect(result.errors[0]).toContain("高校名称");
  });

  it("导出交付记录为 CSV", () => {
    const csv = exportDeliveriesToCsv(sampleDeliveries.slice(0, 1));

    expect(csv).toContain("省份");
    expect(csv).toContain("清华大学");
    expect(csv).toContain("FastGPT;EDS");
    expect(csv).toContain("设备明细");
    expect(csv).toContain("业务痛点");
    expect(csv).not.toContain("经度");
    expect(csv).not.toContain("纬度");
  });

  it("返回 PapaParse 格式错误", () => {
    const csv = ["省份,地区/城市,高校名称", '广东省,深圳市,"深圳大学'].join("\n");
    const result = parseDeliveryCsv(csv);

    expect(result.records).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toMatch(/第 \d+ 行/);
    expect(result.errors[0]).toMatch(/MissingQuotes|Quoted field unterminated/);
  });

  it("返回字段数量不匹配错误", () => {
    const csv = ["省份,地区/城市,高校名称", "广东省,深圳市,深圳大学,多余字段"].join("\n");
    const result = parseDeliveryCsv(csv);

    expect(result.records).toHaveLength(0);
    expect(result.errors.some((error) => error.includes("第 2 行") && error.includes("TooManyFields"))).toBe(true);
  });

  it("返回非法资源数量错误并保留空白资源数量为 undefined", () => {
    const invalidCsv = [
      "省份,地区/城市,高校名称,资源数量",
      "广东省,深圳市,深圳大学,abc",
    ].join("\n");
    const invalidResult = parseDeliveryCsv(invalidCsv);

    expect(invalidResult.records).toHaveLength(0);
    expect(invalidResult.errors[0]).toContain("第 2 行");
    expect(invalidResult.errors[0]).toContain("资源数量");

    const blankCsv = [
      "省份,地区/城市,高校名称,资源数量",
      "广东省,深圳市,深圳大学,   ",
    ].join("\n");
    const blankResult = parseDeliveryCsv(blankCsv);

    expect(blankResult.errors).toEqual([]);
    expect(blankResult.records[0].resourceAmount).toBeUndefined();
  });

  it("导入旧 CSV 的经纬度列时忽略坐标内容", () => {
    const csv = [
      "省份,地区/城市,高校名称,经度,纬度",
      "广东省,深圳市,深圳大学,lng,lat",
    ].join("\n");
    const result = parseDeliveryCsv(csv);

    expect(result.errors).toEqual([]);
    expect(result.records).toHaveLength(1);
    expect(result.records[0].longitude).toBeUndefined();
    expect(result.records[0].latitude).toBeUndefined();
  });

  it("校验扩展字段 JSON 并解析合法对象", () => {
    const invalidCsv = [
      "省份,地区/城市,高校名称,扩展字段JSON",
      '广东省,深圳市,深圳大学,"[1,2]"',
    ].join("\n");
    const invalidResult = parseDeliveryCsv(invalidCsv);

    expect(invalidResult.records).toHaveLength(0);
    expect(invalidResult.errors[0]).toContain("第 2 行");
    expect(invalidResult.errors[0]).toContain("扩展字段JSON");

    const validCsv = [
      "省份,地区/城市,高校名称,扩展字段JSON",
      '广东省,深圳市,深圳大学,"{""priority"":""high"",""count"":2}"',
    ].join("\n");
    const validResult = parseDeliveryCsv(validCsv);

    expect(validResult.errors).toEqual([]);
    expect(validResult.records[0].extraJson).toEqual({ priority: "high", count: 2 });
  });

  it("校验覆盖状态和项目阶段枚举", () => {
    const csv = [
      "省份,地区/城市,高校名称,覆盖状态,项目阶段",
      "广东省,深圳市,深圳大学,错误状态,错误阶段",
    ].join("\n");
    const result = parseDeliveryCsv(csv);

    expect(result.records).toHaveLength(0);
    expect(result.errors[0]).toContain("第 2 行");
    expect(result.errors[0]).toContain("覆盖状态");
    expect(result.errors[0]).toContain("项目阶段");
  });

  it("解析英文字段别名", () => {
    const csv = [
      "province,city,university,purchaseTags,productTags,resourceAmount,coverageStatus,projectStage",
      "广东省,深圳市,深圳大学,VMware替换;信创,SDDC;EDS,12,已覆盖,交付",
    ].join("\n");
    const result = parseDeliveryCsv(csv);

    expect(result.errors).toEqual([]);
    expect(result.records[0].province).toBe("广东省");
    expect(result.records[0].purchaseTags).toEqual(["VMware替换", "信创"]);
    expect(result.records[0].productTags).toEqual(["SDDC", "EDS"]);
    expect(result.records[0].coverageStatus).toBe("已覆盖");
    expect(result.records[0].projectStage).toBe("交付");
  });

  it("正确解析 quoted comma 和 newline", () => {
    const csv = [
      "省份,地区/城市,高校名称,交付内容",
      '广东省,深圳市,深圳大学,"第一行,包含逗号\n第二行"',
    ].join("\n");
    const result = parseDeliveryCsv(csv);

    expect(result.errors).toEqual([]);
    expect(result.records[0].deliveryContent).toBe("第一行,包含逗号\n第二行");
  });

  it("导出后再解析保留核心字段", () => {
    const exported = exportDeliveriesToCsv(sampleDeliveries.slice(0, 1));
    const result = parseDeliveryCsv(exported);

    expect(result.errors).toEqual([]);
    expect(result.records[0].university).toBe("清华大学");
    expect(result.records[0].productTags).toEqual(["FastGPT", "EDS"]);
    expect(result.records[0].resourceAmount).toBe(12);
    expect(result.records[0].equipmentDetails?.length).toBeGreaterThan(0);
    expect(result.records[0].painPoints?.length).toBeGreaterThan(0);
  });
});
