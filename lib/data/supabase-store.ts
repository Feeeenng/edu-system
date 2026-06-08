import "server-only";
import { dedupeDeliveries } from "@/lib/data/dedupe";
import { validateDeliveryRecordShape } from "@/lib/data/validation";
import type { DeliveryRecord } from "@/lib/types";

type SupabaseDeliveryRow = {
  id: string;
  payload: unknown;
  updated_at: string;
};

type SupabaseErrorPayload = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const token = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !token) {
    throw new Error("Supabase 未配置 NEXT_PUBLIC_SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }

  return {
    url: url.replace(/\/$/, ""),
    token,
  };
}

async function requestSupabase(path: string, init: RequestInit = {}) {
  const config = getSupabaseConfig();
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: config.token,
      authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    let payload: SupabaseErrorPayload | undefined;
    try {
      payload = detail ? (JSON.parse(detail) as SupabaseErrorPayload) : undefined;
    } catch {
      payload = undefined;
    }

    if (payload?.code === "PGRST205") {
      throw new Error("Supabase 数据表 public.deliveries 不存在或 schema cache 未刷新，请先执行 supabase/schema.sql 建表");
    }

    throw new Error(`Supabase 请求失败：HTTP ${response.status}${detail ? ` - ${detail}` : ""}`);
  }

  return response;
}

function normalizeRow(row: SupabaseDeliveryRow): DeliveryRecord {
  const payload = row.payload;
  const record =
    typeof payload === "object" && payload !== null
      ? {
          ...(payload as Record<string, unknown>),
          id: row.id,
          updatedAt: row.updated_at,
        }
      : payload;

  const result = validateDeliveryRecordShape(record);
  if (!result.ok) {
    throw new Error(`Supabase 交付数据损坏：记录 ${row.id}${result.error}`);
  }

  return record as DeliveryRecord;
}

function toSupabaseRows(records: DeliveryRecord[]) {
  return dedupeDeliveries(records).map((record) => ({
    id: record.id,
    payload: record,
    updated_at: record.updatedAt,
  }));
}

function quotePostgrestValue(value: string) {
  return encodeURIComponent(`"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`);
}

export async function readSupabaseRecords(): Promise<DeliveryRecord[]> {
  const response = await requestSupabase("deliveries?select=id,payload,updated_at&order=updated_at.desc", {
    method: "GET",
  });
  const rows = (await response.json()) as SupabaseDeliveryRow[];
  return dedupeDeliveries(rows.map(normalizeRow));
}

export async function writeSupabaseRecords(records: DeliveryRecord[]) {
  const rows = toSupabaseRows(records);
  const ids = rows.map((row) => row.id);

  let savedRows: SupabaseDeliveryRow[] = [];
  if (rows.length > 0) {
    const response = await requestSupabase("deliveries?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(rows),
    });
    savedRows = (await response.json()) as SupabaseDeliveryRow[];
  }

  if (ids.length === 0) {
    await requestSupabase("deliveries?id=not.is.null", { method: "DELETE" });
    return [];
  }

  await requestSupabase(`deliveries?id=not.in.(${ids.map(quotePostgrestValue).join(",")})`, { method: "DELETE" });
  return dedupeDeliveries(savedRows.map(normalizeRow));
}
