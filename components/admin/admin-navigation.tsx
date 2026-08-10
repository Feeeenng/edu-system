import {
  AppstoreOutlined,
  BankOutlined,
  CloudServerOutlined,
  DatabaseOutlined,
  DeploymentUnitOutlined,
  FileTextOutlined,
  HomeOutlined,
  KeyOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import type { ReactNode } from "react";

export type AdminNavigationItem = {
  key: string;
  label: string;
  icon?: ReactNode;
  href?: string;
  children?: AdminNavigationItem[];
};

export const ADMIN_NAVIGATION: AdminNavigationItem[] = [
  { key: "workspace", icon: <HomeOutlined />, label: "工作台" },
  {
    key: "university-management",
    icon: <BankOutlined />,
    label: "高校管理",
    children: [{ key: "university-info", label: "高校信息维护", href: "/admin" }],
  },
  { key: "customer", icon: <TeamOutlined />, label: "客户管理" },
  { key: "product", icon: <AppstoreOutlined />, label: "产品配置" },
  { key: "resource", icon: <DatabaseOutlined />, label: "资源池管理" },
  { key: "delivery", icon: <DeploymentUnitOutlined />, label: "项目交付" },
  { key: "sync", icon: <CloudServerOutlined />, label: "数据同步" },
  { key: "report", icon: <FileTextOutlined />, label: "报表中心" },
  {
    key: "settings",
    icon: <SettingOutlined />,
    label: "系统设置",
    children: [
      {
        key: "security",
        icon: <SafetyCertificateOutlined />,
        label: "安全",
        children: [{ key: "password-settings", icon: <KeyOutlined />, label: "密码修改", href: "/admin/settings/password" }],
      },
    ],
  },
];

/** 将后台导航配置转换为 Ant Design 菜单数据。 */
export function getAdminMenuItems(items: AdminNavigationItem[] = ADMIN_NAVIGATION): MenuProps["items"] {
  return items.map((item) => ({
    key: item.key,
    icon: item.icon,
    label: item.label,
    children: item.children ? getAdminMenuItems(item.children) : undefined,
  }));
}

/** 返回目标菜单从一级导航到当前页面的完整路径。 */
export function getAdminNavigationTrail(key: string, items: AdminNavigationItem[] = ADMIN_NAVIGATION): AdminNavigationItem[] {
  for (const item of items) {
    if (item.key === key) return [item];
    const childTrail = item.children ? getAdminNavigationTrail(key, item.children) : [];
    if (childTrail.length > 0) return [item, ...childTrail];
  }
  return [];
}

/** 查找菜单配置，供统一路由和占位提示使用。 */
export function getAdminNavigationItem(key: string) {
  return getAdminNavigationTrail(key).at(-1);
}
