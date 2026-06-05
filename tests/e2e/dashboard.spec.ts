import { expect, test } from "@playwright/test";

test("dashboard scaffold renders", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "高校业务覆盖大屏" })).toBeVisible();
  await expect(page.getByText("项目脚手架已就绪。")).toBeVisible();
});

test("admin scaffold renders", async ({ page }) => {
  await page.goto("/admin");

  await expect(page.getByRole("heading", { name: "数据管理" })).toBeVisible();
  await expect(page.getByText("管理页面脚手架已就绪。")).toBeVisible();
});
