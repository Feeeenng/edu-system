import { describe, expect, it } from "vitest";
import { sampleDeliveries } from "@/tests/fixtures/deliveries";

describe("sampleDeliveries", () => {
  it("包含可用于全国、省份、地区和高校钻取的记录", () => {
    expect(sampleDeliveries.length).toBeGreaterThanOrEqual(16);
    expect(new Set(sampleDeliveries.map((item) => item.province)).size).toBeGreaterThanOrEqual(5);
    expect(sampleDeliveries.every((item) => item.province && item.city && item.university)).toBe(true);
  });

  it("包含采购标签和产品标签，便于筛选测试", () => {
    const purchaseTags = new Set(sampleDeliveries.flatMap((item) => item.purchaseTags));
    const productTags = new Set(sampleDeliveries.flatMap((item) => item.productTags));

    expect(purchaseTags).toContain("VMware替换");
    expect(purchaseTags).toContain("信创");
    expect(purchaseTags).toContain("AI超融合");
    expect(productTags).toContain("SDDC");
    expect(productTags).toContain("FastGPT");
    expect(productTags).toContain("EDS");
    expect(productTags).toContain("桌面云");
  });

  it("包含学校设备明细和业务痛点，便于详情页展示", () => {
    expect(sampleDeliveries.every((item) => item.equipmentDetails && item.equipmentDetails.length > 0)).toBe(true);
    expect(sampleDeliveries.every((item) => item.painPoints && item.painPoints.length > 0)).toBe(true);
  });
});
