import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdminPage from "@/app/admin/page";
import type { DeliveryRecord } from "@/lib/types";

const createdRecord: DeliveryRecord = {
  id: "delivery-admin-test",
  province: "广东省",
  city: "深圳市",
  university: "测试录入大学",
  provinceUniversityTotal: 160,
  cityUniversityTotal: 18,
  purchaseTags: ["信创"],
  productTags: ["SDDC", "EDS"],
  equipmentDetails: ["超融合节点x3", "EDS存储节点x2"],
  painPoints: ["VMware替换压力大", "科研数据增长快"],
  updatedAt: "2026-06-08T00:00:00.000Z",
};

describe("AdminPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("提供高校交付数据录入表单并能新增记录到列表", async () => {
    let records: DeliveryRecord[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/admin/session")) {
        return new Response(JSON.stringify({ configured: true, unlocked: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (!init?.method || init.method === "GET") {
        return new Response(JSON.stringify({ records }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (init.method === "POST") {
        records = [createdRecord];
        return new Response(JSON.stringify({ record: createdRecord }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
    });

    render(<AdminPage />);

    expect(screen.getByRole("heading", { name: "高校交付数据录入" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "导出CSV" })).toBeInTheDocument();
    expect(screen.getByLabelText("CSV导入")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "新增" })).toBeEnabled());

    const newRow = document.querySelector("tr.entry-new-row");
    expect(newRow).not.toBeNull();
    const selects = newRow!.querySelectorAll("select");
    const inputs = newRow!.querySelectorAll("input");

    fireEvent.change(selects[0], { target: { value: "广东省" } });
    await waitFor(() => expect(selects[1]).toBeEnabled());
    fireEvent.change(selects[1], { target: { value: "深圳市" } });
    fireEvent.change(inputs[0], { target: { value: "测试录入大学" } });
    fireEvent.change(inputs[1], { target: { value: "160" } });
    fireEvent.change(inputs[2], { target: { value: "18" } });
    fireEvent.change(inputs[3], { target: { value: "SDDC;EDS" } });
    fireEvent.change(inputs[4], { target: { value: "信创" } });
    fireEvent.change(inputs[5], { target: { value: "超融合节点x3;EDS存储节点x2" } });
    fireEvent.change(inputs[6], { target: { value: "VMware替换压力大;科研数据增长快" } });
    fireEvent.click(screen.getByRole("button", { name: "新增" }));

    const table = screen.getByRole("table");
    await waitFor(() => expect(table).toHaveTextContent("测试录入大学"));
    expect(table).toHaveTextContent("160");
    expect(table).toHaveTextContent("18");
    expect(table).toHaveTextContent("超融合节点x3 / EDS存储节点x2");
    expect(table).toHaveTextContent("VMware替换压力大 / 科研数据增长快");
  });
});
