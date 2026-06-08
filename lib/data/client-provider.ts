"use client";

import { createApiProvider } from "@/lib/data/api-provider";
import { createBrowserProvider } from "@/lib/data/browser-provider";
import type { DeliveryDataProvider } from "@/lib/data/provider";
import type { DeliveryRecord } from "@/lib/types";

export function shouldUseApiProvider() {
  return process.env.NEXT_PUBLIC_DATA_MODE === "api" && typeof window !== "undefined" && window.location.protocol !== "file:";
}

export function createClientProvider(seed: DeliveryRecord[] = []): DeliveryDataProvider {
  return shouldUseApiProvider() ? createApiProvider() : createBrowserProvider(seed);
}
