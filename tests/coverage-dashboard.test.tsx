import { act } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CoverageDashboard } from "@/components/dashboard/CoverageDashboard";
import { sampleDeliveries } from "@/tests/fixtures/deliveries";
import type { DeliveryRecord } from "@/lib/types";

function createDeliveryRecord(overrides: Partial<DeliveryRecord>): DeliveryRecord {
  return {
    id: overrides.id ?? "delivery-test-001",
    province: overrides.province ?? "广东省",
    city: overrides.city ?? "深圳市",
    university: overrides.university ?? "测试大学",
    customerStatus: "测试客户",
    coverageStatus: "已部署",
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
  it("没有真实数据时显示空态和录入页入口", async () => {
    render(<CoverageDashboard />);

    expect(screen.getByRole("heading", { name: "高校产品案例覆盖率热力图" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("请先导入真实交付数据")).toBeInTheDocument());
    expect(screen.queryByLabelText("首页CSV导入")).not.toBeInTheDocument();
    expect(screen.queryByText("导入CSV")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "进入录入页" }).getAttribute("href")).toMatch(/admin/);
    expect(screen.queryByRole("button", { name: /广东省/ })).not.toBeInTheDocument();
  });

  it("使用后台配置的首页标题", async () => {
    render(<CoverageDashboard initialRecords={[]} initialSiteConfig={{ dashboardTitle: "高校覆盖作战地图" }} />);

    expect(screen.getByRole("heading", { name: "高校覆盖作战地图" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "高校产品案例覆盖率热力图" })).not.toBeInTheDocument();
  });

  it("首页不提供 CSV 导入且保留已有真实数据展示", async () => {
    render(<CoverageDashboard initialRecords={[createDeliveryRecord({ university: "已有真实大学" })]} />);

    await waitFor(() => expect(screen.getByText("广东省省份覆盖率最高，达到 100%。")).toBeInTheDocument());
    expect(screen.queryByLabelText("首页CSV导入")).not.toBeInTheDocument();
    expect(screen.getByText("广东省省份覆盖率最高，达到 100%。")).toBeInTheDocument();
  });

  it("支持省份筛选", async () => {
    render(<CoverageDashboard initialRecords={[createDeliveryRecord({ university: "省份筛选大学" })]} />);

    await waitFor(() => expect(screen.getByRole("button", { name: /广东省/ })).toBeInTheDocument());
    act(() => fireEvent.click(screen.getAllByRole("button", { name: /广东省/ })[0]));
    expect(screen.getByRole("heading", { name: "广东省覆盖率热力图" })).toBeInTheDocument();
    expect(screen.getByText("当前省份")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "返回省份" })).not.toBeInTheDocument();
  });

  it("展示 ECharts 全国地图并支持点击省份查看高校案例", async () => {
    render(<CoverageDashboard initialRecords={sampleDeliveries} />);

    expect(screen.getByRole("heading", { name: "高校产品案例覆盖率热力图" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: /广东省/ })).toBeInTheDocument());

    const map = screen.getByRole("img", { name: "ECharts 中国高校覆盖地图" });
    expect(map).toBeInTheDocument();

    act(() => fireEvent.click(screen.getAllByRole("button", { name: /广东省/ })[0]));

    expect(screen.getByRole("heading", { name: "广东省覆盖率热力图" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "返回全国" })).toBeInTheDocument();
    expect(screen.getByLabelText("按省份筛选高校案例")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "返回省份" })).not.toBeInTheDocument();
  });

  it("点击产品后查看对应全国覆盖版图和覆盖率排行", async () => {
    render(<CoverageDashboard initialRecords={sampleDeliveries} />);

    await waitFor(() => expect(screen.getByRole("button", { name: /SDDC/ })).toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "交付部署全国覆盖率热力图" })).toBeInTheDocument();

    act(() => screen.getByRole("button", { name: /SDDC/ }).click());

    expect(screen.getByRole("heading", { name: "SDDC全国覆盖率热力图" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "省份覆盖率全量排行" })).toBeInTheDocument();

    act(() => screen.getByRole("button", { name: /EDS/ }).click());

    expect(screen.getByRole("heading", { name: "EDS全国覆盖率热力图" })).toBeInTheDocument();
    expect(screen.getByText(/视图按省份统计/)).toBeInTheDocument();

    act(() => screen.getByRole("button", { name: /桌面云/ }).click());

    expect(screen.getByRole("heading", { name: "桌面云全国覆盖率热力图" })).toBeInTheDocument();
    expect(screen.getByText(/桌面云视图按省份统计/)).toBeInTheDocument();
  });

  it("按同一高校聚合多条交付计算覆盖数", async () => {
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

    await waitFor(() => expect(screen.getByText("覆盖数（分子）")).toBeInTheDocument());
    expect(screen.getByText("广东省省份覆盖率最高，达到 100%。")).toBeInTheDocument();
    expect(screen.getByText("广东省已部署 1 所高校，可作为交付部署重点样板区域。")).toBeInTheDocument();
  });
});
