import { expect, test } from "@playwright/test";

test("dashboard coverage map supports product filtering and province drilldown", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "高校产品案例覆盖地图" })).toBeVisible();
  await expect(page.getByRole("img", { name: "全国高校案例覆盖地图" })).toBeVisible();

  await page.getByRole("button", { name: /SDDC/ }).click();
  await expect(page.getByRole("heading", { name: "SDDC 全国案例覆盖" })).toBeVisible();

  await page.getByRole("button", { name: /广东省/ }).first().click();
  await expect(page.getByRole("heading", { name: "广东省覆盖详情" })).toBeVisible();
  await expect(page.getByRole("button", { name: "返回全国" })).toBeVisible();
});

test("admin scaffold renders", async ({ page }) => {
  await page.goto("/admin");

  await expect(page.getByRole("heading", { name: "数据管理" })).toBeVisible();
  await expect(page.getByText("管理页面脚手架已就绪。")).toBeVisible();
});
