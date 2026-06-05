import { describe, expect, it } from "vitest";
import { filterDeliveries } from "@/lib/analytics/filter";
import { buildCoverageSummary, groupByCity, groupByProvince, getUniversityDetail } from "@/lib/analytics/summary";
import { rankUniversities } from "@/lib/analytics/rankings";
import { mockDeliveries } from "@/lib/mock/deliveries";
import type { DeliveryRecord } from "@/lib/types";

function makeDelivery(overrides: Partial<DeliveryRecord>): DeliveryRecord {
  return {
    id: "fixture-delivery",
    province: "测试省",
    city: "测试市",
    university: "测试大学",
    purchaseTags: ["信创"],
    productTags: ["EDS"],
    updatedAt: "2026-06-05T00:00:00+08:00",
    ...overrides,
  };
}

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
    const withoutEmptyTags = buildCoverageSummary([
      makeDelivery({
        id: "empty-tags-001",
        productTags: ["EDS", ""],
        purchaseTags: ["信创", ""],
      }),
    ]);

    expect(summary.deliveryCount).toBe(mockDeliveries.length);
    expect(summary.provinceCount).toBeGreaterThanOrEqual(5);
    expect(summary.cityCount).toBeGreaterThanOrEqual(8);
    expect(summary.universityCount).toBeGreaterThanOrEqual(16);
    expect(summary.productCount).toBe(4);
    expect(summary.purchaseTagCount).toBe(3);
    expect(withoutEmptyTags.productCount).toBe(1);
    expect(withoutEmptyTags.purchaseTagCount).toBe(1);
  });

  it("按省份和城市聚合高校覆盖", () => {
    const provinces = groupByProvince(mockDeliveries);
    const cities = groupByCity(mockDeliveries, "广东省");
    const tiedProvinces = groupByProvince([
      makeDelivery({ id: "province-zj-001", province: "浙江省", city: "杭州市", university: "浙江大学" }),
      makeDelivery({ id: "province-ah-001", province: "安徽省", city: "合肥市", university: "安徽大学" }),
    ]);
    const tiedCities = groupByCity(
      [
        makeDelivery({ id: "city-sz-001", province: "广东省", city: "深圳市", university: "深圳大学" }),
        makeDelivery({ id: "city-gz-001", province: "广东省", city: "广州市", university: "中山大学" }),
      ],
      "广东省",
    );

    expect(provinces.find((item) => item.name === "广东省")?.universityCount).toBe(3);
    expect(cities.map((item) => item.name)).toEqual(expect.arrayContaining(["广州市", "深圳市"]));
    expect(tiedProvinces.map((item) => item.name)).toEqual(["安徽省", "浙江省"]);
    expect(tiedCities.map((item) => item.name)).toEqual(["广州市", "深圳市"]);
  });

  it("获取高校详情并按交付日期倒序", () => {
    const detail = getUniversityDetail(
      [
        makeDelivery({
          id: "detail-001",
          province: "广东省",
          city: "深圳市",
          university: "深圳大学",
          deliveryDate: "2025-09-10",
          productTags: ["SDDC"],
        }),
        makeDelivery({
          id: "detail-002",
          province: "广东省",
          city: "深圳市",
          university: "深圳大学",
          deliveryDate: "2025-10-12",
          productTags: ["FastGPT"],
        }),
      ],
      "广东省",
      "深圳市",
      "深圳大学",
    );

    expect(detail?.university).toBe("深圳大学");
    expect(detail?.deliveries.map((item) => item.deliveryDate)).toEqual(["2025-10-12", "2025-09-10"]);
    expect(detail?.deliveries.length).toBe(2);
    expect(detail?.productTags).toContain("SDDC");
  });

  it("按交付记录数生成高校排行", () => {
    const ranking = rankUniversities([
      ...mockDeliveries,
      { ...mockDeliveries[0], id: "delivery-bj-tsinghua-002", deliveryDate: "2025-04-18" },
      { ...mockDeliveries[0], id: "delivery-bj-tsinghua-003", deliveryDate: "2025-05-18" },
      { ...mockDeliveries[3], id: "delivery-gd-sysu-002", deliveryDate: "2025-09-14" },
    ]);
    const tiedRanking = rankUniversities([
      makeDelivery({ id: "rank-zj-001", province: "浙江省", city: "杭州市", university: "同名大学" }),
      makeDelivery({ id: "rank-ah-001", province: "安徽省", city: "合肥市", university: "同名大学" }),
    ]);

    expect(ranking.length).toBeGreaterThan(0);
    for (let index = 1; index < ranking.length; index += 1) {
      expect(ranking[index - 1].deliveryCount).toBeGreaterThanOrEqual(ranking[index].deliveryCount);
    }
    expect(ranking[0]).toMatchObject({ name: "清华大学", deliveryCount: 3 });
    expect(tiedRanking.map((item) => item.province)).toEqual(["安徽省", "浙江省"]);
  });
});
