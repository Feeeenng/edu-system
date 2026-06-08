import { expect, test, type Page } from "@playwright/test";

const e2eCsv = [
  "省份,地区/城市,高校名称,产品标签,采购标签,省份高校总数,城市高校总数,设备明细,业务痛点",
  "广东省,深圳市,测试录入大学,SDDC;EDS,信创,2,1,超融合节点x3;EDS存储节点x2,VMware替换压力大;科研数据增长快",
  "广东省,广州市,广州测试大学,EDS,AI超融合,2,1,对象存储节点x4,科研归档容量不足",
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
  await expect(page.getByRole("button", { name: /广东省/ }).first()).toBeVisible();
}

test("dashboard coverage map supports product filtering and province drilldown", async ({ page }) => {
  await openCleanDashboard(page);

  await expect(page.getByRole("heading", { name: "高校产品案例覆盖率热力图" })).toBeVisible();
  await expect(page.getByText("请先导入真实交付数据")).toBeVisible();
  await importDashboardCsv(page);

  await expect(page.getByText("ECharts 中国地图")).toBeVisible();
  await expect(page.getByRole("img", { name: "ECharts 中国高校覆盖地图" })).toBeVisible();

  await page.getByRole("button", { name: /SDDC/ }).click();
  await expect(page.getByRole("heading", { name: "SDDC全国覆盖率热力图" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "覆盖率最高的5个省份" })).toBeVisible();

  await page.getByRole("button", { name: /广东省/ }).first().click();
  await expect(page.getByRole("heading", { name: "广东省城市覆盖率热力图" })).toBeVisible();
  await expect(page.getByText("ECharts 广东省地图")).toBeVisible();
  await page.getByRole("button", { name: /深圳市/ }).first().click();
  await expect(page.getByRole("heading", { name: "广东省 / 深圳市覆盖率热力图" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "覆盖率最高的5个城市" })).toBeVisible();
  await expect(page.getByRole("button", { name: "返回全国" })).toBeVisible();
  await expect(page.getByRole("button", { name: "返回省份" })).toBeVisible();
});

test("admin data entry creates a server delivery record", async ({ page }) => {
  await page.request.patch("/api/deliveries", { data: [] });
  await page.goto("/admin");

  await expect(page.getByRole("heading", { name: "高校交付数据录入" })).toBeVisible();
  await expect(page.getByRole("button", { name: "新增记录" })).toBeEnabled();

  const composePanel = page.getByLabel("新增高校交付记录");
  await composePanel.locator("select").nth(0).selectOption("广东省");
  await expect(composePanel.locator("select").nth(1)).toBeEnabled();
  await composePanel.locator("select").nth(1).selectOption("深圳市");
  await composePanel.locator("input").nth(0).fill("测试录入大学");
  await composePanel.locator("input").nth(1).fill("160");
  await composePanel.locator("input").nth(2).fill("18");
  await composePanel.locator("input").nth(3).fill("SDDC;EDS");
  await composePanel.locator("input").nth(5).fill("超融合节点x3;EDS存储节点x2");
  await composePanel.locator("input").nth(6).fill("VMware替换压力大;科研数据增长快");
  await composePanel.getByRole("button", { name: "新增记录" }).click();

  const table = page.getByRole("table");
  await expect(table.getByText("测试录入大学", { exact: true })).toBeVisible();
  await expect(table.getByText("超融合节点x3 / EDS存储节点x2")).toBeVisible();
  await expect(table.getByText("VMware替换压力大 / 科研数据增长快")).toBeVisible();

  await page.goto("/");
  await page.getByLabel("搜索高校、设备、业务痛点").fill("测试录入大学");
  await expect(page.getByRole("heading", { name: "高校产品案例覆盖率热力图" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "覆盖率最高的5个省份" })).toBeVisible();
});
