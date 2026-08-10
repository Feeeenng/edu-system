"use client";

import {
  BellOutlined,
  LeftOutlined,
  LockOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MoreOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Avatar, Breadcrumb, Button, Dropdown, Grid, Input, Layout, Menu, Space, Tooltip } from "antd";
import type { MenuProps } from "antd";
import type { ReactNode } from "react";
import { useState } from "react";

const { Header, Content, Sider } = Layout;

type ManagementBrand = {
  name: string;
  subtitle: string;
  icon: ReactNode;
};

type ManagementShellProps = {
  brand: ManagementBrand;
  menuItems: MenuProps["items"];
  selectedKeys: string[];
  defaultOpenKeys?: string[];
  breadcrumbs: string[];
  userName: string;
  children: ReactNode;
  onMenuSelect?(key: string): void;
  onLogout?(): void;
};

/** 提供可配置菜单、页头和响应式侧栏的通用业务应用壳。 */
export function ManagementShell({
  brand,
  menuItems,
  selectedKeys,
  defaultOpenKeys,
  breadcrumbs,
  userName,
  children,
  onMenuSelect,
  onLogout,
}: ManagementShellProps) {
  const screens = Grid.useBreakpoint();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <Layout className="management-shell">
      <Sider
        className="management-sider"
        width={208}
        collapsedWidth={0}
        collapsed={collapsed}
        breakpoint="lg"
        onBreakpoint={(broken) => setCollapsed(broken)}
      >
        <div className="management-brand">
          <div className="management-brand-mark">{brand.icon}</div>
          <div>
            <strong>{brand.name}</strong>
            <span>{brand.subtitle}</span>
          </div>
        </div>
        <Menu
          mode="inline"
          selectedKeys={selectedKeys}
          defaultOpenKeys={defaultOpenKeys}
          items={menuItems}
          onClick={({ key }) => onMenuSelect?.(key)}
        />
        <Button className="management-collapse-footer" type="text" icon={<LeftOutlined />} onClick={() => setCollapsed(true)}>
          收起菜单
        </Button>
      </Sider>

      <Layout>
        <Header className="management-header">
          <Space size={16} className="management-header-left">
            <Button
              type="text"
              aria-label={collapsed ? "展开菜单" : "收起菜单"}
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed((value) => !value)}
            />
            <Breadcrumb items={breadcrumbs.map((title) => ({ title }))} />
          </Space>
          <Space size={16}>
            {screens.md ? <Input className="management-header-search" prefix={<SearchOutlined />} placeholder="搜索菜单、功能、数据..." readOnly /> : null}
            <Tooltip title="消息通知"><Button type="text" icon={<BellOutlined />} /></Tooltip>
            <Tooltip title="帮助中心"><Button type="text" icon={<QuestionCircleOutlined />} /></Tooltip>
            <Dropdown menu={{ items: onLogout ? [{ key: "logout", icon: <LockOutlined />, label: "退出管理模式", onClick: onLogout }] : [] }}>
              <Button className="management-user" type="text">
                <Avatar size="small" icon={<UserOutlined />} />
                {screens.md ? <span>{userName}</span> : null}
                <MoreOutlined />
              </Button>
            </Dropdown>
          </Space>
        </Header>
        <Content className="management-content">{children}</Content>
      </Layout>
    </Layout>
  );
}
