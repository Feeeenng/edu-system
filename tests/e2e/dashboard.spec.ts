import { expect, test, type Page } from "@playwright/test";

async function openCleanDashboard(page: Page) {
  await page.request.patch("/api/deliveries", { data: [] });
  await page.goto("/");
}

async function seedDashboardRecords(page: Page) {
  await page.request.patch("/api/deliveries", {
    data: [
      {
        id: "e2e-dashboard-gd-sz",
        province: "广东省",
        city: "深圳市",
        university: "测试录入大学",
        productTags: ["SDDC", "EDS"],
        purchaseTags: ["信创"],
        equipmentDetails: ["超融合节点x3", "EDS存储节点x2"],
        painPoints: ["VMware替换压力大", "科研数据增长快"],
        updatedAt: "2026-06-09T00:00:00+08:00",
      },
      {
        id: "e2e-dashboard-gd-gz",
        province: "广东省",
        city: "广州市",
        university: "广州测试大学",
        productTags: ["EDS"],
        purchaseTags: ["AI超融合"],
        equipmentDetails: ["对象存储节点x4"],
        painPoints: ["科研归档容量不足"],
        updatedAt: "2026-06-09T00:00:00+08:00",
      },
    ],
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: /广东省/ }).first()).toBeVisible();
}

test("dashboard coverage map supports product filtering and province selection", async ({ page }) => {
  await openCleanDashboard(page);

  await expect(page.getByRole("heading", { name: "高校产品案例覆盖率热力图" })).toBeVisible();
  await expect(page.getByText("请先导入真实交付数据")).toBeVisible();
  await expect(page.getByLabel("首页CSV导入")).toHaveCount(0);
  await seedDashboardRecords(page);

  await expect(page.getByRole("img", { name: "ECharts 中国高校覆盖地图" })).toBeVisible();

  await page.getByRole("button", { name: /SDDC/ }).click();
  await expect(page.getByRole("heading", { name: "SDDC全国覆盖率热力图" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "省份覆盖率全量排行" })).toBeVisible();

  await page.getByRole("button", { name: /广东省/ }).first().click();
  await expect(page.getByRole("heading", { name: "广东省覆盖率热力图" })).toBeVisible();
  await expect(page.getByLabel("按省份筛选高校案例")).toBeVisible();
  await expect(page.getByRole("button", { name: "返回全国" })).toBeVisible();
  await expect(page.getByRole("button", { name: "返回省份" })).toHaveCount(0);
});

test("admin data entry creates a server delivery record", async ({ page }) => {
  await page.request.patch("/api/deliveries", { data: [] });
  await page.goto("/admin");

  await expect(page.getByRole("heading", { name: "高校信息维护" })).toBeVisible();
  await expect(page.getByRole("button", { name: "新增记录" })).toBeEnabled();

  const composePanel = page.getByLabel("新增高校信息记录");
  await composePanel.locator("input").nth(0).fill("1");
  await composePanel.locator("select").nth(0).selectOption("广东省");
  await composePanel.locator("input").nth(1).fill("测试录入大学");
  await composePanel.locator("select").nth(1).selectOption("已部署");
  await composePanel.locator("input").nth(2).fill("信息中心华为超融合");
  await composePanel.locator("input").nth(3).fill("2025年");
  await composePanel.locator("input").nth(4).fill("信创");
  await composePanel.locator("input").nth(5).fill("SDDC");
  await composePanel.locator("input").nth(6).fill("4");
  await composePanel.locator("input").nth(7).fill("C");
  await composePanel.locator("input").nth(8).fill("会议中心系统");
  await composePanel.locator("input").nth(9).fill("VMware替换压力大");
  await composePanel.locator("input").nth(10).fill("纯软件交付");
  await composePanel.getByRole("button", { name: "新增记录" }).click();

  const table = page.getByRole("table");
  await expect(table.getByText("测试录入大学", { exact: true })).toBeVisible();
  await expect(table.getByText("会议中心系统")).toBeVisible();
  await expect(table.getByText("VMware替换压力大")).toBeVisible();

  await page.goto("/");
  await page.getByLabel("搜索高校、设备、业务痛点").fill("测试录入大学");
  await expect(page.getByRole("heading", { name: "高校产品案例覆盖率热力图" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "省份覆盖率全量排行" })).toBeVisible();
});
