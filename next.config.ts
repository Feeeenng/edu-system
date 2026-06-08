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
    allowedDevOrigins: ["127.0.0.1"],
  };
}

const nextConfig = createNextConfig({
  staticExport: process.env.NEXT_OUTPUT_EXPORT === "true",
});

export default nextConfig;
