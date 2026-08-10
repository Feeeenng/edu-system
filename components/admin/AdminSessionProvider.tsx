"use client";

import { App as AntApp } from "antd";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { clearAdminSession, getAdminSession, unlockAdminSession } from "@/lib/admin-session-client";

type AdminSessionContextValue = {
  loading: boolean;
  configured: boolean;
  unlocked: boolean;
  source?: "database" | "environment";
  unlock(password: string): Promise<void>;
  logout(): Promise<void>;
  markDatabasePassword(): void;
};

const AdminSessionContext = createContext<AdminSessionContextValue | undefined>(undefined);

/** 在管理端路由间复用管理员会话，避免页面切换时重复请求。 */
export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const { message } = AntApp.useApp();
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [source, setSource] = useState<"database" | "environment">();

  useEffect(() => {
    let active = true;
    void getAdminSession()
      .then((session) => {
        if (!active) return;
        setConfigured(Boolean(session.configured));
        setUnlocked(Boolean(session.unlocked));
        setSource(session.source);
      })
      .catch((error) => {
        if (active) message.error(error instanceof Error ? error.message : "管理权限读取失败");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [message]);

  const value = useMemo<AdminSessionContextValue>(() => ({
    loading,
    configured,
    unlocked,
    source,
    async unlock(password) {
      const session = await unlockAdminSession(password);
      if (!session.unlocked) throw new Error("管理密码验证失败");
      setConfigured(Boolean(session.configured));
      setUnlocked(true);
      setSource(session.source);
    },
    async logout() {
      await clearAdminSession();
      setUnlocked(false);
    },
    markDatabasePassword() {
      setConfigured(true);
      setSource("database");
      setUnlocked(true);
    },
  }), [configured, loading, source, unlocked]);

  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
}

/** 获取布局级管理员会话，必须在 AdminSessionProvider 内调用。 */
export function useAdminSession() {
  const context = useContext(AdminSessionContext);
  if (!context) throw new Error("useAdminSession 必须在 AdminSessionProvider 内使用");
  return context;
}
