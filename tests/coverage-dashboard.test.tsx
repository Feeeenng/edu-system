import { act } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CoverageDashboard } from "@/components/dashboard/CoverageDashboard";
import type { DeliveryRecord } from "@/lib/types";

function createDeliveryRecord(overrides: Partial<DeliveryRecord>): DeliveryRecord {
  return {
    id: overrides.id ?? "delivery-test-001",
    province: overrides.province ?? "测试省",
    city: overrides.city ?? "测试市",
    university: overrides.university ?? "测试大学",
    customerStatus: "测试客户",
    coverageStatus: "已覆盖",
    projectStage: "交付",
    deliveryDate: "2026-06-05",
    owner: "测试负责人",
    purchaseTags: overrides.purchaseTags ?? ["信创"],
    productTags: overrides.productTags ?? ["SDDC"],
    resourceType: "测试资源",
    resourceAmount: 1,
    resourceUnit: "套",
    deliveryContent: "测试交付内容",
    equipmentDetails: overrides.equipmentDetails ?? ["测试设备x1"],
    painPoints: overrides.painPoints ?? ["测试痛点"],
    updatedAt: "2026-06-05T10:00:00+08:00",
    ...overrides,
  };
}

describe("CoverageDashboard", () => {
  it("展示产品案例覆盖入口并支持点击产品过滤", async () => {
    render(<CoverageDashboard />);

    expect(screen.getByRole("heading", { name: "按产品查看全国高校覆盖版图" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: /SDDC/ })).toBeInTheDocument());

    act(() => screen.getByRole("button", { name: /SDDC/ }).click());

    expect(screen.getByRole("heading", { name: "SDDC 案例分布" })).toBeInTheDocument();
    expect(screen.getByText("设备与业务痛点")).toBeInTheDocument();
    expect(screen.getAllByText(/超融合节点|SDDC控制器|万兆交换机/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/VMware授权成本持续上升|老旧虚拟化平台扩容困难/).length).toBeGreaterThan(0);

    act(() => screen.getByRole("button", { name: /EDS/ }).click());

    expect(screen.getByRole("heading", { name: "EDS 案例分布" })).toBeInTheDocument();
    expect(screen.getAllByText(/AI训练资源池管理套件|对象存储网关x2/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/AI教学环境缺少统一资源池|多院系存储孤岛难统一运维/).length).toBeGreaterThan(0);

    act(() => screen.getByRole("button", { name: /桌面云/ }).click());

    expect(screen.getByRole("heading", { name: "桌面云 案例分布" })).toBeInTheDocument();
    expect(screen.getAllByText(/瘦终端x150|教学终端x180|教学终端x260/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/课程环境切换效率低|教学镜像维护重复/).length).toBeGreaterThan(0);
  });

  it("按同一高校聚合多条交付并完整展示设备和痛点", async () => {
    const records = [
      createDeliveryRecord({
        id: "delivery-merge-001",
        university: "聚合测试大学",
        equipmentDetails: ["第一套设备", "共享设备"],
        painPoints: ["第一类业务痛点"],
      }),
      createDeliveryRecord({
        id: "delivery-merge-002",
        university: "聚合测试大学",
        equipmentDetails: ["第二套设备", "共享设备"],
        painPoints: ["第二类业务痛点"],
      }),
    ];

    render(<CoverageDashboard initialRecords={records} />);

    await waitFor(() => expect(screen.getByText("聚合测试大学")).toBeInTheDocument());
    expect(screen.getByText("第一套设备")).toBeInTheDocument();
    expect(screen.getByText("第二套设备")).toBeInTheDocument();
    expect(screen.getAllByText("共享设备")).toHaveLength(1);
    expect(screen.getByText("第一类业务痛点")).toBeInTheDocument();
    expect(screen.getByText("第二类业务痛点")).toBeInTheDocument();
  });

  it("展示筛选后的全部高校，不按 8 所高校截断", async () => {
    const records = Array.from({ length: 9 }, (_, index) =>
      createDeliveryRecord({
        id: `delivery-many-${index + 1}`,
        province: `测试省${index + 1}`,
        city: `测试市${index + 1}`,
        university: `覆盖测试大学${index + 1}`,
        equipmentDetails: [`第${index + 1}所设备`],
        painPoints: [`第${index + 1}所痛点`],
      }),
    );

    render(<CoverageDashboard initialRecords={records} />);

    await waitFor(() => expect(screen.getByText("覆盖测试大学9")).toBeInTheDocument());
    expect(screen.getByText("第9所设备")).toBeInTheDocument();
    expect(screen.getByText("第9所痛点")).toBeInTheDocument();
  });
});
