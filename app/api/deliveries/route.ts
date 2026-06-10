import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/api/admin-auth";
import { dedupeDeliveries, getDeliveryBusinessKey } from "@/lib/data/dedupe";
import { createDeliveryRecord } from "@/lib/data/normalize";
import { mutateServerRecords, readServerRecords } from "@/lib/data/server-store";
import { validateDeliveryPayload, validateDeliveryPayloadArray } from "@/lib/data/validation";
import type { DeliveryPayload } from "@/lib/types";

async function readJsonBody(request: Request): Promise<{ ok: true; data: unknown } | { ok: false; response: Response }> {
  try {
    return { ok: true, data: await request.json() };
  } catch {
    return { ok: false, response: NextResponse.json({ error: "请求 JSON 格式错误" }, { status: 400 }) };
  }
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

class RouteStatusError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function statusError(error: string, status: number) {
  return new RouteStatusError(error, status);
}

export async function GET() {
  const records = await readServerRecords();
  return NextResponse.json({ records }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const unauthorized = requireAdminRequest(request);
  if (unauthorized) return unauthorized;

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const validation = validateDeliveryPayload(body.data);
  if (!validation.ok) return jsonError(validation.error, 400);

  const payload = body.data as DeliveryPayload;
  const record = createDeliveryRecord(payload);
  await mutateServerRecords((records) => dedupeDeliveries([record, ...records]));
  return NextResponse.json({ record }, { status: 201 });
}

export async function PUT(request: Request) {
  const unauthorized = requireAdminRequest(request);
  if (unauthorized) return unauthorized;

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const validation = validateDeliveryPayload(body.data);
  if (!validation.ok) return jsonError(validation.error, 400);

  const payload = body.data as DeliveryPayload;
  if (!payload.id) {
    return jsonError("缺少记录 ID", 400);
  }

  const updated = createDeliveryRecord({ ...payload, updatedAt: new Date().toISOString() });
  try {
    await mutateServerRecords((records) => {
      if (!records.some((record) => record.id === payload.id)) {
        throw statusError("记录不存在", 404);
      }

      const updatedKey = getDeliveryBusinessKey(updated);
      return records
        .filter((record) => record.id === payload.id || getDeliveryBusinessKey(record) !== updatedKey)
        .map((record) => (record.id === payload.id ? updated : record));
    });
  } catch (error) {
    if (error instanceof RouteStatusError) return jsonError(error.message, error.status);
    throw error;
  }

  return NextResponse.json({ record: updated });
}

export async function DELETE(request: Request) {
  const unauthorized = requireAdminRequest(request);
  if (unauthorized) return unauthorized;

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  if (!body.data || typeof body.data !== "object" || Array.isArray(body.data)) {
    return jsonError("请求体必须是对象", 400);
  }

  const { id } = body.data as { id?: unknown };
  if (!id) {
    return jsonError("缺少记录 ID", 400);
  }

  if (typeof id !== "string") {
    return jsonError("记录 ID 必须是字符串", 400);
  }

  try {
    await mutateServerRecords((records) => {
      if (!records.some((record) => record.id === id)) {
        throw statusError("记录不存在", 404);
      }

      return records.filter((record) => record.id !== id);
    });
  } catch (error) {
    if (error instanceof RouteStatusError) return jsonError(error.message, error.status);
    throw error;
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const unauthorized = requireAdminRequest(request);
  if (unauthorized) return unauthorized;

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const validation = validateDeliveryPayloadArray(body.data);
  if (!validation.ok) return jsonError(validation.error, 400);

  const payloads = body.data as DeliveryPayload[];
  const records = await mutateServerRecords(() => dedupeDeliveries(payloads.map(createDeliveryRecord)));
  return NextResponse.json({ records });
}
