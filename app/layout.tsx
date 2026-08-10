import type { Metadata } from "next";
import "antd/dist/reset.css";
import "@/components/ui/management-ui.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "云数智管",
  description: "高校信息维护与业务覆盖管理系统",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
