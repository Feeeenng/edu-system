"use client";

import { KeyOutlined, LockOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { App as AntApp, Button, Card, Form, Input, Space, Tag, Typography } from "antd";
import { useState } from "react";
import { AdminAccessGate } from "@/components/admin/AdminAccessGate";
import { useAdminSession } from "@/components/admin/AdminSessionProvider";
import { AdminShell } from "@/components/admin/AdminShell";

const { Title, Paragraph, Text } = Typography;

type PasswordFormValues = {
  currentPassword?: string;
  newPassword: string;
  confirmPassword: string;
};

async function updateAdminPassword(values: PasswordFormValues) {
  const response = await fetch("/api/admin/password", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ currentPassword: values.currentPassword, newPassword: values.newPassword }),
  });
  const text = await response.text();
  let payload: { error?: string } = {};
  try {
    payload = text ? (JSON.parse(text) as { error?: string }) : {};
  } catch {
    payload = {};
  }
  if (!response.ok) throw new Error(payload.error ?? `密码保存失败：HTTP ${response.status}`);
}

/** 管理员密码设置页，仅提交当前密码和新密码，不展示任何密码或哈希。 */
export function AdminPasswordSettings() {
  const { message } = AntApp.useApp();
  const { configured, source, logout, markDatabasePassword } = useAdminSession();
  const [form] = Form.useForm<PasswordFormValues>();
  const [saving, setSaving] = useState(false);

  const logoutAdmin = async () => {
    try {
      await logout();
      message.success("已退出管理模式。");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "退出管理模式失败");
    }
  };

  const savePassword = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await updateAdminPassword(values);
      form.resetFields();
      markDatabasePassword();
      message.success("管理员密码已更新并保存到数据库。");
    } catch (error) {
      if (error instanceof Error) message.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell selectedKey="password-settings" onLogout={() => void logoutAdmin()}>
      <AdminAccessGate description="输入管理密码后才可查看和修改安全设置。">
          <section className="management-page-heading">
            <div>
              <Title level={2}>管理员密码修改</Title>
              <Paragraph>密码以加盐哈希写入数据库，保存后当前管理员会话会使用新凭据续签。</Paragraph>
            </div>
            <Tag color={source === "database" ? "success" : "default"}>{source === "database" ? "数据库密码" : "环境变量引导"}</Tag>
          </section>

          <Card className="management-settings-card" bordered={false}>
            <Space align="start" size={12} className="management-settings-intro">
              <SafetyCertificateOutlined />
              <div>
                <Title level={4}>更新管理员密码</Title>
                <Text type="secondary">密码长度至少 8 位，当前密码和新密码均不会在浏览器持久化。</Text>
              </div>
            </Space>
            <Form form={form} layout="vertical" requiredMark={false} className="management-settings-form">
              {configured ? (
                <Form.Item label="当前管理员密码" name="currentPassword" rules={[{ required: true, message: "请输入当前管理员密码" }]}>
                  <Input.Password prefix={<LockOutlined />} autoComplete="current-password" placeholder="请输入当前管理员密码" />
                </Form.Item>
              ) : null}
              <Form.Item label="新管理员密码" name="newPassword" rules={[{ required: true, message: "请输入新管理员密码" }, { min: 8, message: "管理员密码至少需要 8 位" }]}>
                <Input.Password prefix={<KeyOutlined />} autoComplete="new-password" placeholder="请输入至少 8 位的新密码" />
              </Form.Item>
              <Form.Item
                label="确认新管理员密码"
                name="confirmPassword"
                dependencies={["newPassword"]}
                rules={[
                  { required: true, message: "请再次输入新管理员密码" },
                  ({ getFieldValue }) => ({ validator: (_, value) => !value || getFieldValue("newPassword") === value ? Promise.resolve() : Promise.reject(new Error("两次输入的密码不一致")) }),
                ]}
              >
                <Input.Password prefix={<KeyOutlined />} autoComplete="new-password" placeholder="请再次输入新密码" />
              </Form.Item>
              <Button type="primary" loading={saving} onClick={() => void savePassword()}>保存管理员密码</Button>
            </Form>
          </Card>
      </AdminAccessGate>
    </AdminShell>
  );
}
