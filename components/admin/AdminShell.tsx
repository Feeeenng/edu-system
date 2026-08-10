"use client";

import {
  BookOutlined,
} from "@ant-design/icons";
import { App as AntApp } from "antd";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { getAdminMenuItems, getAdminNavigationItem, getAdminNavigationTrail } from "@/components/admin/admin-navigation";
import { ManagementShell } from "@/components/ui/ManagementShell";

type AdminShellProps = {
  selectedKey: string;
  children: ReactNode;
  onLogout(): void;
};

/** 集中管理后台菜单、路由与共享应用壳，页面只提供当前菜单和业务内容。 */
export function AdminShell({ selectedKey, children, onLogout }: AdminShellProps) {
  const { message } = AntApp.useApp();
  const router = useRouter();
  const trail = getAdminNavigationTrail(selectedKey);

  const navigate = (key: string) => {
    const item = getAdminNavigationItem(key);
    if (item?.href) {
      router.push(item.href);
      return;
    }
    if (item && !item.children) {
      message.info("该模块正在规划中。");
    }
  };

  return (
    <ManagementShell
      brand={{ name: "云数智管", subtitle: "后台管理系统", icon: <BookOutlined /> }}
      menuItems={getAdminMenuItems()}
      selectedKeys={[selectedKey]}
      defaultOpenKeys={trail.slice(0, -1).map((item) => item.key)}
      breadcrumbs={["后台管理", ...trail.map((item) => item.label)]}
      userName="系统管理员"
      onMenuSelect={navigate}
      onLogout={onLogout}
    >
      {children}
    </ManagementShell>
  );
}
