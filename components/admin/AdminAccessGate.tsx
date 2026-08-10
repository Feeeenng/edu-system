"use client";

import { App as AntApp, Button, Input, Modal, Space, Spin, Typography } from "antd";
import { useState } from "react";
import type { ReactNode } from "react";
import { useAdminSession } from "@/components/admin/AdminSessionProvider";

const { Paragraph } = Typography;

type AdminAccessGateProps = {
  children: ReactNode;
  description: string;
};

/** 统一隐藏未授权内容并提供管理员密码验证弹窗。 */
export function AdminAccessGate({ children, description }: AdminAccessGateProps) {
  const { message } = AntApp.useApp();
  const { loading, unlocked, unlock } = useAdminSession();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!password) {
      message.warning("请输入管理密码。");
      return;
    }
    try {
      setSubmitting(true);
      await unlock(password);
      setPassword("");
      message.success("管理权限已验证。");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "管理密码验证失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {unlocked ? children : (
        <section className="management-auth-placeholder" aria-label="正在验证管理权限">
          {loading ? <Spin size="large" /> : null}
        </section>
      )}
      <Modal title="验证管理权限" open={!loading && !unlocked} closable={false} footer={null} centered>
        <Paragraph type="secondary">{description}首次使用默认密码为 123456，请登录后及时修改。</Paragraph>
        <Space.Compact block>
          <Input.Password
            autoFocus
            value={password}
            placeholder="管理密码"
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            onPressEnter={() => void submit()}
          />
          <Button type="primary" loading={submitting} onClick={() => void submit()}>验证</Button>
        </Space.Compact>
      </Modal>
    </>
  );
}
