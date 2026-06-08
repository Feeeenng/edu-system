import { act } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
    provinceUniversityTotal: overrides.provinceUniversityTotal ?? 1,
    cityUniversityTotal: overrides.cityUniversityTotal ?? 1,
    updatedAt: "2026-06-05T10:00:00+08:00",
    ...overrides,
  };
}

describe("CoverageDashboard", () => {
  it("没有真实数据时显示空态和导入入口", async () => {
    render(<CoverageDashboard />);

    expect(screen.getByRole("heading", { name: "高校产品案例覆盖率热力图" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("请先导入真实交付数据")).toBeInTheDocument());
    expect(screen.getByLabelText("首页CSV导入")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "进入录入页" }).getAttribute("href")).toMatch(/admin/);
    expect(screen.queryByRole("button", { name: /广东省/ })).not.toBeInTheDocument();
  });

  it("首页支持直接导入 CSV 并刷新覆盖版图", async () => {
    render(<CoverageDashboard />);

    const file = new File(
      [
        [
          "省份,地区/城市,高校名称,产品标签,采购标签,省份高校总数,城市高校总数,设备明细,业务痛点",
          "广东省,深圳市,首页导入大学,SDDC,信创,1,1,超融合节点x3,真实数据上传",
        ].join("\n"),
      ],
      "deliveries.csv",
      { type: "text/csv" },
    );

    fireEvent.change(screen.getByLabelText("首页CSV导入"), { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText("广东省省份覆盖率最高，达到 100%。")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /广东省/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "覆盖率最高的5个省份" })).toBeInTheDocument();
  });

  it("首页导入只有表头的 CSV 不会清空已有真实数据", async () => {
    render(<CoverageDashboard initialRecords={[createDeliveryRecord({ university: "已有真实大学" })]} />);

    await waitFor(() => expect(screen.getByText("广东省省份覆盖率最高，达到 100%。")).toBeInTheDocument());

    const file = new File(["省份,地区/城市,高校名称,产品标签"], "empty.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText("首页CSV导入"), { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText("CSV中没有可导入的记录，已保留现有数据。")).toBeInTheDocument());
    expect(screen.getByText("广东省省份覆盖率最高，达到 100%。")).toBeInTheDocument();
  });

  it("导入省份简称时会标准化为完整省名并支持市级下钻", async () => {
    render(<CoverageDashboard />);

    const file = new File(
      [
        [
          "省份,地区/城市,高校名称,产品标签,采购标签,省份高校总数,城市高校总数,设备明细,业务痛点",
          "广东,深圳市,简称省份大学,SDDC,信创,1,1,超融合节点x2,省份简称录入",
        ].join("\n"),
      ],
      "short-province.csv",
      { type: "text/csv" },
    );

    fireEvent.change(screen.getByLabelText("首页CSV导入"), { target: { files: [file] } });

    await waitFor(() => expect(screen.getByRole("button", { name: /广东省/ })).toBeInTheDocument());
    act(() => fireEvent.click(screen.getAllByRole("button", { name: /广东省/ })[0]));
    expect(screen.getByRole("heading", { name: "广东省城市覆盖率热力图" })).toBeInTheDocument();
    act(() => fireEvent.click(screen.getAllByRole("button", { name: /深圳市/ })[0]));
    expect(screen.getByRole("heading", { name: "广东省 / 深圳市覆盖率热力图" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "覆盖率最高的5个城市" })).toBeInTheDocument();
  });

  it("展示 ECharts 全国地图并支持点击省份钻取到市级区域", async () => {
    render(<CoverageDashboard initialRecords={sampleDeliveries} />);

    expect(screen.getByRole("heading", { name: "高校产品案例覆盖率热力图" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: /广东省/ })).toBeInTheDocument());

    expect(screen.getByText("ECharts 中国地图")).toBeInTheDocument();
    const map = screen.getByRole("img", { name: "ECharts 中国高校覆盖地图" });
    expect(within(map).getByRole("button", { name: /广东省/ })).toBeInTheDocument();

    act(() => fireEvent.click(within(map).getByRole("button", { name: /广东省/ })));

    expect(screen.getByRole("heading", { name: "广东省城市覆盖率热力图" })).toBeInTheDocument();
    expect(screen.getByText("ECharts 广东省地图")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "返回全国" })).toBeInTheDocument();
    expect(within(map).getByRole("button", { name: /深圳市/ })).toBeInTheDocument();
    expect(within(map).getByRole("button", { name: /广州市/ })).toBeInTheDocument();

    act(() => fireEvent.click(within(map).getByRole("button", { name: /深圳市/ })));

    expect(screen.getByRole("heading", { name: "广东省 / 深圳市覆盖率热力图" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "返回省份" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "覆盖率最高的5个城市" })).toBeInTheDocument();
    expect(screen.queryByText("中山大学")).not.toBeInTheDocument();
  });

  it("点击产品后查看对应全国覆盖版图和覆盖率排行", async () => {
    render(<CoverageDashboard initialRecords={sampleDeliveries} />);

    await waitFor(() => expect(screen.getByRole("button", { name: /SDDC/ })).toBeInTheDocument());

    act(() => screen.getByRole("button", { name: /SDDC/ }).click());

    expect(screen.getByRole("heading", { name: "SDDC全国覆盖率热力图" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "覆盖率最高的5个省份" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "覆盖率最低的5个省份" })).toBeInTheDocument();

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
    expect(screen.getByText("广东省已覆盖 1 所高校，可作为全部重点样板区域。")).toBeInTheDocument();
  });
});
