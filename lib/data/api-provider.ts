"use client";

import type { DeliveryDataProvider } from "@/lib/data/provider";
import type { DeliveryPayload, DeliveryRecord } from "@/lib/types";

function buildJsonHeaders() {
  return {
    "Content-Type": "application/json",
  };
}

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

export function createApiProvider(): DeliveryDataProvider {
  return {
    async list() {
      const payload = await readJsonResponse<{ records?: DeliveryRecord[] }>(
        await fetch("/api/deliveries", { cache: "no-store" }),
      );
      return Array.isArray(payload.records) ? payload.records : [];
    },
    async replaceAll(records) {
      const payload = await readJsonResponse<{ records?: DeliveryRecord[] }>(
        await fetch("/api/deliveries", {
          method: "PATCH",
          headers: buildJsonHeaders(),
          credentials: "same-origin",
          body: JSON.stringify(records),
        }),
      );
      return Array.isArray(payload.records) ? payload.records : [];
    },
    async create(payload) {
      const result = await readJsonResponse<{ record: DeliveryRecord }>(
        await fetch("/api/deliveries", {
          method: "POST",
          headers: buildJsonHeaders(),
          credentials: "same-origin",
          body: JSON.stringify(payload),
        }),
      );
      return result.record;
    },
    async update(id, payload) {
      const result = await readJsonResponse<{ record: DeliveryRecord }>(
        await fetch("/api/deliveries", {
          method: "PUT",
          headers: buildJsonHeaders(),
          credentials: "same-origin",
          body: JSON.stringify({ ...payload, id }),
        }),
      );
      return result.record;
    },
    async remove(id) {
      await readJsonResponse<{ ok: true }>(
        await fetch("/api/deliveries", {
          method: "DELETE",
          headers: buildJsonHeaders(),
          credentials: "same-origin",
          body: JSON.stringify({ id }),
        }),
      );
    },
  };
}
