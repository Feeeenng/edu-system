import path from "node:path";
import { describe, expect, it } from "vitest";
import { shouldExcludeFromStaticExport } from "@/scripts/export-static.mjs";

describe("static export script filters", () => {
  const root = "/repo";

  it("只按顶层 data 目录排除本地数据，不排除 lib/data 源码", () => {
    expect(shouldExcludeFromStaticExport(path.join(root, "data", "deliveries.local.json"), root)).toBe(true);
    expect(shouldExcludeFromStaticExport(path.join(root, "lib", "data", "server-store.ts"), root)).toBe(false);
  });

  it("排除任意路径段里的 .env* 文件", () => {
    expect(shouldExcludeFromStaticExport(path.join(root, ".env.local"), root)).toBe(true);
    expect(shouldExcludeFromStaticExport(path.join(root, "public", ".env.production"), root)).toBe(true);
  });
});
