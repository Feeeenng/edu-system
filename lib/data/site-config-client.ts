"use client";

import type { SiteConfig } from "@/lib/types";

async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: (T & { error?: string }) | undefined;
  try {
    payload = text ? (JSON.parse(text) as T & { error?: string }) : undefined;
  } catch {
    if (!response.ok) {
      throw new Error(`接口请求失败：HTTP ${response.status}${text ? ` - ${text.slice(0, 120)}` : ""}`);
    }
    throw new Error("接口返回格式错误：不是合法 JSON");
  }

  if (!response.ok) {
    throw new Error(payload?.error ?? `接口请求失败：HTTP ${response.status}`);
  }
  return (payload ?? {}) as T;
}

export async function readSiteConfig() {
  const payload = await readJsonResponse<{ config?: SiteConfig }>(
    await fetch("/api/site-config", { cache: "no-store" }),
  );
  return payload.config;
}

export async function saveSiteConfig(config: SiteConfig) {
  const payload = await readJsonResponse<{ config?: SiteConfig }>(
    await fetch("/api/site-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(config),
    }),
  );
  return payload.config;
}
