import type { NextConfig } from "next";

type CreateNextConfigOptions = {
  staticExport: boolean;
};

export function createNextConfig({ staticExport }: CreateNextConfigOptions): NextConfig {
  return {
    output: staticExport ? "export" : undefined,
    trailingSlash: staticExport,
    assetPrefix: staticExport ? "./" : undefined,
    images: { unoptimized: staticExport },
    devIndicators: false,
    allowedDevOrigins: ["127.0.0.1", "localhost", "10.10.51.140"],
    serverExternalPackages: ["sql.js"],
    onDemandEntries: {
      maxInactiveAge: 60 * 60 * 1000,
      pagesBufferLength: 16,
    },
    modularizeImports: {
      antd: {
        transform: "antd/es/{{kebabCase member}}",
      },
      "@ant-design/icons": {
        transform: "@ant-design/icons/es/icons/{{member}}",
      },
    },
  };
}

const nextConfig = createNextConfig({
  staticExport: process.env.NEXT_OUTPUT_EXPORT === "true",
});

export default nextConfig;
