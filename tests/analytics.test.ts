import { describe, expect, it } from "vitest";
import { filterDeliveries } from "@/lib/analytics/filter";
import { buildCoverageSummary, groupByProvince, getUniversityDetail } from "@/lib/analytics/summary";
import { rankUniversities } from "@/lib/analytics/rankings";
import { makeDelivery, sampleDeliveries } from "@/tests/fixtures/deliveries";

describe("analytics", () => {
  it("按多个产品标签筛选交付记录时要求全部命中", () => {
    const result = filterDeliveries(sampleDeliveries, {
      productTags: ["FastGPT", "EDS"],
    });

    expect(result.length).toBeGreaterThan(0);
    expect(result.every((item) => item.productTags.includes("FastGPT"))).toBe(true);
    expect(result.every((item) => item.productTags.includes("EDS"))).toBe(true);
  });

  it("按多个采购标签筛选交付记录时要求全部命中", () => {
    const result = filterDeliveries(sampleDeliveries, {
      purchaseTags: ["AI超融合", "信创"],
    });

    expect(result.length).toBeGreaterThan(0);
    expect(result.every((item) => item.purchaseTags.includes("AI超融合"))).toBe(true);
    expect(result.every((item) => item.purchaseTags.includes("信创"))).toBe(true);
  });

  it("按省份城市和高校精确筛选交付记录", () => {
    const result = filterDeliveries(sampleDeliveries, {
      province: "广东省",
      city: "深圳市",
      university: "深圳大学",
    });

    expect(result.length).toBe(1);
    expect(result[0]).toMatchObject({
      province: "广东省",
      city: "深圳市",
      university: "深圳大学",
    });
  });

  it("按覆盖状态和项目阶段筛选交付记录", () => {
    const result = filterDeliveries(sampleDeliveries, {
      coverageStatus: "跟进中",
      projectStage: "测试",
    });

    expect(result.length).toBeGreaterThan(0);
    expect(result.every((item) => item.coverageStatus === "跟进中")).toBe(true);
    expect(result.every((item) => item.projectStage === "测试")).toBe(true);
  });

  it("按关键词匹配高校负责人交付内容和标签", () => {
    const universityMatches = filterDeliveries(sampleDeliveries, { keyword: "深圳大学" });
    const ownerMatches = filterDeliveries(sampleDeliveries, { keyword: "张明" });
    const contentMatches = filterDeliveries(sampleDeliveries, { keyword: "科研知识库" });
    const tagMatches = filterDeliveries(sampleDeliveries, { keyword: "桌面云" });
    const equipmentMatches = filterDeliveries(sampleDeliveries, { keyword: "SDDC控制器" });
    const painPointMatches = filterDeliveries(sampleDeliveries, { keyword: "VMware授权成本" });

    expect(universityMatches.length).toBeGreaterThan(0);
    expect(ownerMatches.length).toBeGreaterThan(0);
    expect(contentMatches.length).toBeGreaterThan(0);
    expect(tagMatches.length).toBeGreaterThan(0);
    expect(equipmentMatches.length).toBeGreaterThan(0);
    expect(painPointMatches.length).toBeGreaterThan(0);
    expect(universityMatches.some((item) => item.university === "深圳大学")).toBe(true);
    expect(ownerMatches.every((item) => item.owner === "张明")).toBe(true);
    expect(contentMatches.some((item) => item.deliveryContent?.includes("科研知识库"))).toBe(true);
    expect(tagMatches.every((item) => item.productTags.includes("桌面云"))).toBe(true);
    expect(equipmentMatches.some((item) => item.equipmentDetails?.includes("SDDC控制器x1"))).toBe(true);
    expect(painPointMatches.some((item) => item.painPoints?.includes("VMware授权成本持续上升"))).toBe(true);
  });

  it("统计全国覆盖摘要", () => {
    const summary = buildCoverageSummary(sampleDeliveries);
    const withoutEmptyTags = buildCoverageSummary([
      makeDelivery({
        id: "empty-tags-001",
        productTags: ["EDS", ""],
        purchaseTags: ["信创", ""],
      }),
    ]);

    expect(summary.deliveryCount).toBe(sampleDeliveries.length);
    expect(summary.provinceCount).toBeGreaterThanOrEqual(5);
    expect(summary.cityCount).toBeGreaterThanOrEqual(8);
    expect(summary.universityCount).toBeGreaterThanOrEqual(16);
    expect(summary.productCount).toBe(4);
    expect(summary.purchaseTagCount).toBe(3);
    expect(withoutEmptyTags.productCount).toBe(1);
    expect(withoutEmptyTags.purchaseTagCount).toBe(1);
  });

  it("按省份聚合高校覆盖", () => {
    const provinces = groupByProvince(sampleDeliveries);
    const tiedProvinces = groupByProvince([
      makeDelivery({ id: "province-zj-001", province: "浙江省", city: "杭州市", university: "浙江大学" }),
      makeDelivery({ id: "province-ah-001", province: "安徽省", city: "合肥市", university: "安徽大学" }),
    ]);

    expect(provinces.find((item) => item.name === "广东省")?.universityCount).toBe(3);
    expect(tiedProvinces.map((item) => item.name)).toEqual(["安徽省", "浙江省"]);
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
      ...sampleDeliveries,
      { ...sampleDeliveries[0], id: "delivery-bj-tsinghua-002", deliveryDate: "2025-04-18" },
      { ...sampleDeliveries[0], id: "delivery-bj-tsinghua-003", deliveryDate: "2025-05-18" },
      { ...sampleDeliveries[3], id: "delivery-gd-sysu-002", deliveryDate: "2025-09-14" },
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
