import { describe, expect, it } from "vitest";
import { createNextConfig } from "@/next.config";

describe("next static export config", () => {
  it("静态导出使用相对资源前缀，支持直接打开 out/index.html", () => {
    const config = createNextConfig({ staticExport: true });

    expect(config.output).toBe("export");
    expect(config.trailingSlash).toBe(true);
    expect(config.assetPrefix).toBe("./");
  });
});
