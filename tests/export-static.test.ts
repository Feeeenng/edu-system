import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  getStaticHtmlAssetPrefix,
  rewriteStaticHtmlAssetPaths,
  shouldExcludeFromStaticExport,
} from "@/scripts/export-static.mjs";

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

  it("按 HTML 所在层级生成本地文件可用的静态资源前缀", () => {
    const outRoot = path.join(root, "out");

    expect(getStaticHtmlAssetPrefix(path.join(outRoot, "index.html"), outRoot)).toBe("./");
    expect(getStaticHtmlAssetPrefix(path.join(outRoot, "admin", "index.html"), outRoot)).toBe("../");
    expect(getStaticHtmlAssetPrefix(path.join(outRoot, "reports", "detail", "index.html"), outRoot)).toBe("../../");
  });

  it("重写 HTML 与 Next Flight 数据里的静态资源路径", () => {
    const html = '<link href="./_next/a.css"><script>":HL[\\"./_next/b.css\\"]</script>';

    expect(rewriteStaticHtmlAssetPaths(html, "../")).toBe(
      '<link href="../_next/a.css"><script>":HL[\\"../_next/b.css\\"]</script>',
    );
  });
});
