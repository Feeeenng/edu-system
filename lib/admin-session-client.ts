"use client";

export type AdminSessionPayload = {
  configured?: boolean;
  unlocked?: boolean;
  source?: "database" | "environment";
  error?: string;
};

async function readJsonResponse(response: Response): Promise<AdminSessionPayload> {
  const text = await response.text();
  let payload: AdminSessionPayload = {};

  try {
    payload = text ? (JSON.parse(text) as AdminSessionPayload) : {};
  } catch {
    throw new Error(`管理权限校验失败：HTTP ${response.status}`);
  }

  if (!response.ok) throw new Error(payload.error ?? `管理权限校验失败：HTTP ${response.status}`);
  return payload;
}

/** 获取当前管理员会话状态，不返回密码或哈希。 */
export async function getAdminSession() {
  const response = await fetch("/api/admin/session", { cache: "no-store", credentials: "same-origin" });
  return readJsonResponse(response);
}

/** 使用管理员密码建立 HttpOnly 会话。 */
export async function unlockAdminSession(password: string) {
  const response = await fetch("/api/admin/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ token: password }),
  });
  return readJsonResponse(response);
}

/** 退出当前管理员会话。 */
export async function clearAdminSession() {
  const response = await fetch("/api/admin/session", { method: "DELETE", credentials: "same-origin" });
  if (!response.ok) throw new Error(`退出管理模式失败：HTTP ${response.status}`);
}
