import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdminPage from "@/app/admin/page";
import { parseDeliveryExcel } from "@/lib/excel/workbook";
import type { DeliveryRecord } from "@/lib/types";

vi.mock("@/lib/excel/workbook", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/excel/workbook")>();
  return {
    ...actual,
    parseDeliveryExcel: vi.fn(actual.parseDeliveryExcel),
  };
});

const createdRecord: DeliveryRecord = {
  id: "delivery-admin-test",
  province: "广东省",
  city: "深圳市",
  university: "测试录入大学",
  coverageStatus: "已部署",
  customerStatus: "信息中心华为超融合+少部份VMware",
  purchaseYear: "2025年",
  purchaseTags: ["信创"],
  productTags: ["SDDC"],
  resourceType: "SDDC",
  resourceAmount: 4,
  resourceUnit: "C",
  businessScenario: "会议中心系统",
  coreValue: "VMware替换压力大",
  deviceModel: "纯软件交付",
  updatedAt: "2026-06-08T00:00:00.000Z",
};

describe("AdminPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("提供高校信息维护表单并能新增记录到列表", async () => {
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

    expect(screen.getByRole("heading", { name: "高校信息维护" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "导出XLSX" })).toBeInTheDocument();
    expect(screen.getByLabelText("XLSX导入")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "新增记录" })).toBeEnabled());

    const composePanel = screen.getByLabelText("新增高校信息记录");
    const selects = composePanel.querySelectorAll("select");
    const inputs = composePanel.querySelectorAll("input");

    fireEvent.change(inputs[0], { target: { value: "1" } });
    fireEvent.change(selects[0], { target: { value: "广东省" } });
    fireEvent.change(inputs[1], { target: { value: "测试录入大学" } });
    fireEvent.change(selects[1], { target: { value: "已部署" } });
    fireEvent.change(inputs[2], { target: { value: "信息中心华为超融合" } });
    fireEvent.change(inputs[3], { target: { value: "2025年" } });
    fireEvent.change(inputs[4], { target: { value: "信创" } });
    fireEvent.change(inputs[5], { target: { value: "SDDC" } });
    fireEvent.change(inputs[6], { target: { value: "4" } });
    fireEvent.change(inputs[7], { target: { value: "C" } });
    fireEvent.change(inputs[8], { target: { value: "会议中心系统" } });
    fireEvent.change(inputs[9], { target: { value: "VMware替换压力大" } });
    fireEvent.change(inputs[10], { target: { value: "纯软件交付" } });
    fireEvent.click(screen.getByRole("button", { name: "新增记录" }));

    const table = screen.getByRole("table");
    await waitFor(() => expect(table).toHaveTextContent("测试录入大学"));
    expect(table).toHaveTextContent("SDDC");
    expect(table).toHaveTextContent("会议中心系统");
    expect(table).toHaveTextContent("VMware替换压力大");
  });

  it("上传 XLSX 时显示导入进度条并暂时禁用重复上传", async () => {
    let resolveParse: (() => void) | undefined;
    vi.mocked(parseDeliveryExcel).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveParse = () => resolve({ records: [], errors: [] });
        }),
    );

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/admin/session")) {
        return new Response(JSON.stringify({ configured: true, unlocked: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (!init?.method || init.method === "GET") {
        return new Response(JSON.stringify({ records: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ records: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    render(<AdminPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "新增记录" })).toBeEnabled());

    const input = screen.getByLabelText("XLSX导入");
    const file = new File(["fake"], "高校信息维护清单.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByRole("progressbar", { name: "XLSX导入进度" })).toBeInTheDocument();
    expect(input).toBeDisabled();

    resolveParse?.();
    await waitFor(() => expect(screen.queryByRole("progressbar", { name: "XLSX导入进度" })).not.toBeInTheDocument());
  });
});
