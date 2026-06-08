import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AdminPage from "@/app/admin/page";

describe("AdminPage", () => {
  it("提供高校交付数据录入表单并能新增记录到列表", async () => {
    render(<AdminPage />);

    expect(screen.getByRole("heading", { name: "高校交付数据录入" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "导出CSV" })).toBeInTheDocument();
    expect(screen.getByLabelText("CSV导入")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "新增记录" })).toBeEnabled());

    fireEvent.change(screen.getByLabelText("省份"), { target: { value: "广东省" } });
    fireEvent.change(screen.getByLabelText("城市"), { target: { value: "深圳市" } });
    fireEvent.change(screen.getByLabelText("高校名称"), { target: { value: "测试录入大学" } });
    fireEvent.change(screen.getByLabelText("产品标签"), { target: { value: "SDDC;EDS" } });
    fireEvent.change(screen.getByLabelText("设备明细"), { target: { value: "超融合节点x3;EDS存储节点x2" } });
    fireEvent.change(screen.getByLabelText("业务痛点"), { target: { value: "VMware替换压力大;科研数据增长快" } });
    fireEvent.click(screen.getByRole("button", { name: "新增记录" }));

    const recordList = screen.getByRole("region", { name: "交付记录列表" });
    await waitFor(() => expect(recordList).toHaveTextContent("测试录入大学"));
    expect(recordList).toHaveTextContent("超融合节点x3 / EDS存储节点x2");
    expect(recordList).toHaveTextContent("VMware替换压力大 / 科研数据增长快");
  });
});
