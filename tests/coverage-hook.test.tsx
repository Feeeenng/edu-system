import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCoverageData } from "@/components/dashboard/useCoverageData";
import { sampleDeliveries } from "@/tests/fixtures/deliveries";

describe("useCoverageData", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("有初始真实数据时提供产品案例标签", async () => {
    const { result } = renderHook(() => useCoverageData({ initialRecords: sampleDeliveries }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.records).toHaveLength(sampleDeliveries.length);
    expect(result.current.filteredRecords).toHaveLength(sampleDeliveries.length);
    expect(result.current.productOptions).toEqual(expect.arrayContaining(["SDDC", "EDS", "桌面云", "FastGPT"]));
  });

  it("按产品案例标签过滤全国覆盖记录", async () => {
    const { result } = renderHook(() => useCoverageData({ initialRecords: sampleDeliveries }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setSelectedProductTags(["SDDC"]));

    expect(result.current.filteredRecords.length).toBeGreaterThan(0);
    expect(result.current.filteredRecords.every((record) => record.productTags.includes("SDDC"))).toBe(true);
  });

  it("关键词能命中设备明细和业务痛点", async () => {
    const { result } = renderHook(() => useCoverageData({ initialRecords: sampleDeliveries }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setKeyword("VMware授权成本"));

    expect(result.current.filteredRecords.length).toBeGreaterThan(0);
    expect(result.current.filteredRecords.some((record) => record.painPoints?.includes("VMware授权成本持续上升"))).toBe(true);
  });

  it("默认从服务端 API 读取管理页录入记录", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          records: [
            {
              id: "delivery-api-test",
              province: "广东省",
              city: "深圳市",
              university: "服务端录入大学",
              purchaseTags: ["信创"],
              productTags: ["SDDC"],
              equipmentDetails: ["服务端设备x1"],
              painPoints: ["服务端痛点"],
              updatedAt: "2026-06-06T00:00:00.000Z",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const { result } = renderHook(() => useCoverageData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.records.map((record) => record.university)).toEqual(["服务端录入大学"]);
  });

  it("没有真实数据时默认保持空数据", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ records: [] }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    const { result } = renderHook(() => useCoverageData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.records).toEqual([]);
    expect(result.current.filteredRecords).toEqual([]);
    expect(result.current.productOptions).toEqual([]);
  });
});
