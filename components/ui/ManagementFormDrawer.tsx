"use client";

import { Button, Drawer, Flex, Grid } from "antd";
import type { ReactNode } from "react";

type ManagementFormDrawerProps = {
  title: string;
  open: boolean;
  children: ReactNode;
  onClose(): void;
  onSave?(): void | Promise<void>;
  saveLoading?: boolean;
  saveDisabled?: boolean;
  extra?: ReactNode;
};

/** 提供统一宽度、操作区与响应式行为的通用表单抽屉。 */
export function ManagementFormDrawer({
  title,
  open,
  children,
  onClose,
  onSave,
  saveLoading,
  saveDisabled,
  extra,
}: ManagementFormDrawerProps) {
  const screens = Grid.useBreakpoint();

  return (
    <Drawer
      title={title}
      open={open}
      width={screens.md ? 620 : "100%"}
      onClose={onClose}
      extra={extra}
      footer={
        onSave ? (
          <Flex justify="flex-end" gap={8}>
            <Button onClick={onClose}>取消</Button>
            <Button type="primary" disabled={saveDisabled} loading={saveLoading} onClick={() => void onSave()}>保存</Button>
          </Flex>
        ) : null
      }
    >
      {children}
    </Drawer>
  );
}
