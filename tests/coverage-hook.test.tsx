import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useCoverageData } from "@/components/dashboard/useCoverageData";
import { mockDeliveries } from "@/lib/mock/deliveries";

describe("useCoverageData", () => {
  it("默认加载 mock 数据并提供产品案例标签", async () => {
    const { result } = renderHook(() => useCoverageData({ initialRecords: mockDeliveries }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.records).toHaveLength(mockDeliveries.length);
    expect(result.current.filteredRecords).toHaveLength(mockDeliveries.length);
    expect(result.current.productOptions).toEqual(expect.arrayContaining(["SDDC", "EDS", "桌面云", "FastGPT"]));
  });

  it("按产品案例标签过滤全国覆盖记录", async () => {
    const { result } = renderHook(() => useCoverageData({ initialRecords: mockDeliveries }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setSelectedProductTags(["SDDC"]));

    expect(result.current.filteredRecords.length).toBeGreaterThan(0);
    expect(result.current.filteredRecords.every((record) => record.productTags.includes("SDDC"))).toBe(true);
  });

  it("关键词能命中设备明细和业务痛点", async () => {
    const { result } = renderHook(() => useCoverageData({ initialRecords: mockDeliveries }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setKeyword("VMware授权成本"));

    expect(result.current.filteredRecords.length).toBeGreaterThan(0);
    expect(result.current.filteredRecords.some((record) => record.painPoints?.includes("VMware授权成本持续上升"))).toBe(true);
  });
});
