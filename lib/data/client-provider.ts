"use client";

import { createApiProvider } from "@/lib/data/api-provider";
import type { DeliveryDataProvider } from "@/lib/data/provider";

export function createClientProvider(): DeliveryDataProvider {
  // 客户端统一通过服务端 API 读写，避免浏览器端数据与 Supabase 数据分叉。
  return createApiProvider();
}
