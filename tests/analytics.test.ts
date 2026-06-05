import { describe, expect, it } from "vitest";
import { filterDeliveries } from "@/lib/analytics/filter";
import { buildCoverageSummary, groupByCity, groupByProvince, getUniversityDetail } from "@/lib/analytics/summary";
import { rankUniversities } from "@/lib/analytics/rankings";
import { mockDeliveries } from "@/lib/mock/deliveries";

describe("analytics", () => {
  it("按产品标签和采购标签筛选交付记录", () => {
    const result = filterDeliveries(mockDeliveries, {
      productTags: ["FastGPT"],
      purchaseTags: ["AI超融合"],
    });

    expect(result.length).toBeGreaterThan(0);
    expect(result.every((item) => item.productTags.includes("FastGPT"))).toBe(true);
    expect(result.every((item) => item.purchaseTags.includes("AI超融合"))).toBe(true);
  });

  it("统计全国覆盖摘要", () => {
    const summary = buildCoverageSummary(mockDeliveries);

    expect(summary.deliveryCount).toBe(mockDeliveries.length);
    expect(summary.provinceCount).toBeGreaterThanOrEqual(5);
    expect(summary.cityCount).toBeGreaterThanOrEqual(8);
    expect(summary.universityCount).toBeGreaterThanOrEqual(16);
    expect(summary.productCount).toBe(4);
    expect(summary.purchaseTagCount).toBe(3);
  });

  it("按省份和城市聚合高校覆盖", () => {
    const provinces = groupByProvince(mockDeliveries);
    const cities = groupByCity(mockDeliveries, "广东省");

    expect(provinces.find((item) => item.name === "广东省")?.universityCount).toBe(3);
    expect(cities.map((item) => item.name)).toEqual(expect.arrayContaining(["广州市", "深圳市"]));
  });

  it("获取高校详情并按交付日期倒序", () => {
    const detail = getUniversityDetail(mockDeliveries, "广东省", "深圳市", "深圳大学");

    expect(detail?.university).toBe("深圳大学");
    expect(detail?.deliveries.length).toBe(1);
    expect(detail?.productTags).toContain("SDDC");
  });

  it("按交付记录数生成高校排行", () => {
    const ranking = rankUniversities(mockDeliveries);

    expect(ranking.length).toBeGreaterThan(0);
    expect(ranking[0].deliveryCount).toBeGreaterThanOrEqual(ranking[ranking.length - 1].deliveryCount);
  });
});
