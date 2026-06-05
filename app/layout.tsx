import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "高校业务覆盖大屏",
  description: "高校业务覆盖、交付资源与标签维度展示系统",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
