"use client";

import { App as AntApp, ConfigProvider } from "antd";
import type { ReactNode } from "react";

type ManagementUiProviderProps = {
  children: ReactNode;
};

/** 管理端与运营端共享的 Ant Design 主题入口。 */
export function ManagementUiProvider({ children }: ManagementUiProviderProps) {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#1677ff",
          borderRadius: 8,
          fontFamily: "PingFang SC, Microsoft YaHei, sans-serif",
          colorBgLayout: "#f5f7fa",
        },
        components: {
          Menu: { itemBorderRadius: 6, itemHeight: 40 },
          Table: { headerBg: "#f8fafc", headerColor: "#475467" },
        },
      }}
    >
      <AntApp>{children}</AntApp>
    </ConfigProvider>
  );
}
