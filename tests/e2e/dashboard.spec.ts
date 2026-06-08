import { expect, test, type Page } from "@playwright/test";

const e2eCsv = [
  "省份,地区/城市,高校名称,产品标签,采购标签,设备明细,业务痛点",
  "广东省,深圳市,测试录入大学,SDDC;EDS,信创,超融合节点x3;EDS存储节点x2,VMware替换压力大;科研数据增长快",
  "广东省,广州市,广州测试大学,EDS,AI超融合,对象存储节点x4,科研归档容量不足",
].join("\n");

async function openCleanDashboard(page: Page) {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
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

test("admin data entry creates a local delivery record", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.goto("/admin");

  await expect(page.getByRole("heading", { name: "高校交付数据录入" })).toBeVisible();
  await expect(page.getByRole("button", { name: "新增记录" })).toBeEnabled();

  await page.getByLabel("省份").fill("广东省");
  await page.getByLabel("城市").fill("深圳市");
  await page.getByLabel("高校名称").fill("测试录入大学");
  await page.getByLabel("产品标签").fill("SDDC;EDS");
  await page.getByLabel("设备明细").fill("超融合节点x3;EDS存储节点x2");
  await page.getByLabel("业务痛点").fill("VMware替换压力大;科研数据增长快");
  await page.getByRole("button", { name: "新增记录" }).click();

  const recordList = page.getByRole("region", { name: "交付记录列表" });
  await expect(recordList.getByText("测试录入大学", { exact: true })).toBeVisible();
  await expect(recordList.getByText("超融合节点x3 / EDS存储节点x2")).toBeVisible();
  await expect(recordList.getByText("VMware替换压力大 / 科研数据增长快")).toBeVisible();

  await page.goto("/");
  await page.getByLabel("搜索高校、设备、业务痛点").fill("测试录入大学");
  await expect(page.getByRole("heading", { name: "高校产品案例覆盖地图" })).toBeVisible();
  await expect(page.getByText("测试录入大学").first()).toBeVisible();
});
