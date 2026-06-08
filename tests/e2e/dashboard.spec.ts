import { expect, test, type Page } from "@playwright/test";

const e2eCsv = [
  "省份,地区/城市,高校名称,产品标签,采购标签,设备明细,业务痛点",
  "广东省,深圳市,测试录入大学,SDDC;EDS,信创,超融合节点x3;EDS存储节点x2,VMware替换压力大;科研数据增长快",
  "广东省,广州市,广州测试大学,EDS,AI超融合,对象存储节点x4,科研归档容量不足",
].join("\n");

async function openCleanDashboard(page: Page) {
  await page.request.patch("/api/deliveries", { data: [] });
  await page.goto("/");
}

async function importDashboardCsv(page: Page) {
  await page.getByLabel("首页CSV导入").setInputFiles({
    name: "deliveries.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(e2eCsv),
  });
  await expect(page.getByText("测试录入大学").first()).toBeVisible();
}

test("dashboard coverage map supports product filtering and province drilldown", async ({ page }) => {
  await openCleanDashboard(page);

  await expect(page.getByRole("heading", { name: "高校产品案例覆盖地图" })).toBeVisible();
  await expect(page.getByText("请先导入真实交付数据")).toBeVisible();
  await importDashboardCsv(page);

  await expect(page.getByText("ECharts 中国地图")).toBeVisible();
  await expect(page.getByRole("img", { name: "ECharts 中国高校覆盖地图" })).toBeVisible();

  await page.getByRole("button", { name: /SDDC/ }).click();
  await expect(page.getByRole("heading", { name: "SDDC 全国案例覆盖" })).toBeVisible();
  await expect(page.getByText("VMware替换压力大")).toBeVisible();

  await page.getByRole("button", { name: /广东省/ }).first().click();
  await expect(page.getByRole("heading", { name: "广东省覆盖详情" })).toBeVisible();
  await expect(page.getByText("ECharts 广东省地图")).toBeVisible();
  await page.getByRole("button", { name: /深圳市/ }).first().click();
  await expect(page.getByRole("heading", { name: "广东省 / 深圳市覆盖详情" })).toBeVisible();
  await expect(page.getByText("测试录入大学").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "返回全国" })).toBeVisible();
  await expect(page.getByRole("button", { name: "返回省份" })).toBeVisible();
});

test("admin data entry creates a server delivery record", async ({ page }) => {
  await page.request.patch("/api/deliveries", { data: [] });
  await page.goto("/admin");

  await expect(page.getByRole("heading", { name: "高校交付数据录入" })).toBeVisible();
  await expect(page.getByRole("button", { name: "新增" })).toBeEnabled();

  const newRow = page.locator("tr.entry-new-row");
  await newRow.locator("select").nth(0).selectOption("广东省");
  await expect(newRow.locator("select").nth(1)).toBeEnabled();
  await newRow.locator("select").nth(1).selectOption("深圳市");
  await newRow.locator("input").nth(0).fill("测试录入大学");
  await newRow.locator("input").nth(1).fill("SDDC;EDS");
  await newRow.locator("input").nth(3).fill("超融合节点x3;EDS存储节点x2");
  await newRow.locator("input").nth(4).fill("VMware替换压力大;科研数据增长快");
  await newRow.getByRole("button", { name: "新增" }).click();

  const table = page.getByRole("table");
  await expect(table.getByText("测试录入大学", { exact: true })).toBeVisible();
  await expect(table.getByText("超融合节点x3 / EDS存储节点x2")).toBeVisible();
  await expect(table.getByText("VMware替换压力大 / 科研数据增长快")).toBeVisible();

  await page.goto("/");
  await page.getByLabel("搜索高校、设备、业务痛点").fill("测试录入大学");
  await expect(page.getByRole("heading", { name: "高校产品案例覆盖地图" })).toBeVisible();
  await expect(page.getByText("测试录入大学").first()).toBeVisible();
});
