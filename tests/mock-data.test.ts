import { describe, expect, it } from "vitest";
import { mockDeliveries } from "@/lib/mock/deliveries";

describe("mockDeliveries", () => {
  it("包含可用于全国、省份、地区和高校钻取的记录", () => {
    expect(mockDeliveries.length).toBeGreaterThanOrEqual(16);
    expect(new Set(mockDeliveries.map((item) => item.province)).size).toBeGreaterThanOrEqual(5);
    expect(mockDeliveries.every((item) => item.province && item.city && item.university)).toBe(true);
  });

  it("包含采购标签和产品标签，便于筛选测试", () => {
    const purchaseTags = new Set(mockDeliveries.flatMap((item) => item.purchaseTags));
    const productTags = new Set(mockDeliveries.flatMap((item) => item.productTags));

    expect(purchaseTags).toContain("VMware替换");
    expect(purchaseTags).toContain("信创");
    expect(purchaseTags).toContain("AI超融合");
    expect(productTags).toContain("SDDC");
    expect(productTags).toContain("FastGPT");
    expect(productTags).toContain("EDS");
    expect(productTags).toContain("桌面云");
  });
});
