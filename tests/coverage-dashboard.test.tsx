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
    updatedAt: "2026-06-05T10:00:00+08:00",
    ...overrides,
  };
}

describe("CoverageDashboard", () => {
  it("没有真实数据时显示空态和导入入口", async () => {
    render(<CoverageDashboard />);

    expect(screen.getByRole("heading", { name: "高校产品案例覆盖地图" })).toBeInTheDocument();
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
          "省份,地区/城市,高校名称,产品标签,采购标签,设备明细,业务痛点",
          "广东省,深圳市,首页导入大学,SDDC,信创,超融合节点x3,真实数据上传",
        ].join("\n"),
      ],
      "deliveries.csv",
      { type: "text/csv" },
    );

    fireEvent.change(screen.getByLabelText("首页CSV导入"), { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText("首页导入大学")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /广东省/ })).toBeInTheDocument();
    expect(screen.getByText("真实数据上传")).toBeInTheDocument();
  });

  it("展示 ECharts 全国地图并支持点击省份钻取到市级区域", async () => {
    render(<CoverageDashboard initialRecords={sampleDeliveries} />);

    expect(screen.getByRole("heading", { name: "高校产品案例覆盖地图" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: /广东省/ })).toBeInTheDocument());

    expect(screen.getByText("ECharts 中国地图")).toBeInTheDocument();
    const map = screen.getByRole("img", { name: "ECharts 中国高校覆盖地图" });
    expect(within(map).getByRole("button", { name: /广东省/ })).toBeInTheDocument();

    act(() => fireEvent.click(within(map).getByRole("button", { name: /广东省/ })));

    expect(screen.getByRole("heading", { name: "广东省覆盖详情" })).toBeInTheDocument();
    expect(screen.getByText("ECharts 广东省地图")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "返回全国" })).toBeInTheDocument();
    expect(within(map).getByRole("button", { name: /深圳市/ })).toBeInTheDocument();
    expect(within(map).getByRole("button", { name: /广州市/ })).toBeInTheDocument();

    act(() => fireEvent.click(within(map).getByRole("button", { name: /深圳市/ })));

    expect(screen.getByRole("heading", { name: "广东省 / 深圳市覆盖详情" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "返回省份" })).toBeInTheDocument();
    expect(screen.getByText("深圳大学")).toBeInTheDocument();
    expect(screen.getByText("南方科技大学")).toBeInTheDocument();
    expect(screen.queryByText("中山大学")).not.toBeInTheDocument();
  });

  it("点击产品后查看对应全国覆盖版图和学校设备痛点", async () => {
    render(<CoverageDashboard initialRecords={sampleDeliveries} />);

    await waitFor(() => expect(screen.getByRole("button", { name: /SDDC/ })).toBeInTheDocument());

    act(() => screen.getByRole("button", { name: /SDDC/ }).click());

    expect(screen.getByRole("heading", { name: "SDDC 全国案例覆盖" })).toBeInTheDocument();
    expect(screen.getAllByText(/超融合节点|SDDC控制器|万兆交换机/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/VMware授权成本持续上升|老旧虚拟化平台扩容困难/).length).toBeGreaterThan(0);

    act(() => screen.getByRole("button", { name: /EDS/ }).click());

    expect(screen.getByRole("heading", { name: "EDS 全国案例覆盖" })).toBeInTheDocument();
    expect(screen.getAllByText(/AI训练资源池管理套件|对象存储网关x2/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/AI教学环境缺少统一资源池|多院系存储孤岛难统一运维/).length).toBeGreaterThan(0);

    act(() => screen.getByRole("button", { name: /桌面云/ }).click());

    expect(screen.getByRole("heading", { name: "桌面云 全国案例覆盖" })).toBeInTheDocument();
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
});
