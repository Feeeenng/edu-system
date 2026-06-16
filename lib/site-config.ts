import type { SiteConfig } from "@/lib/types";

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  dashboardTitle: "高校产品案例覆盖率热力图",
};

export function normalizeSiteConfig(value: Partial<SiteConfig> = {}): SiteConfig {
  const dashboardTitle = value.dashboardTitle?.trim() || DEFAULT_SITE_CONFIG.dashboardTitle;
  return { dashboardTitle };
}

export function validateSiteConfigPayload(payload: unknown): { ok: true; config: SiteConfig } | { ok: false; error: string } {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "站点配置必须是对象" };
  }

  const config = payload as Partial<SiteConfig>;
  if (typeof config.dashboardTitle !== "string") {
    return { ok: false, error: "首页标题必须是字符串" };
  }

  if (!config.dashboardTitle.trim()) {
    return { ok: false, error: "首页标题不能为空" };
  }

  return { ok: true, config: normalizeSiteConfig(config) };
}
