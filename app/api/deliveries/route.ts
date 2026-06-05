import { NextResponse } from "next/server";
import { createDeliveryRecord } from "@/lib/data/normalize";
import { readServerRecords, replaceServerRecords, writeServerRecords } from "@/lib/data/server-store";
import { validateDeliveryPayload, validateDeliveryPayloadArray } from "@/lib/data/validation";
import type { DeliveryPayload } from "@/lib/types";

export const dynamic = "force-static";

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

export async function GET() {
  const records = await readServerRecords();
  return NextResponse.json({ records });
}

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const validation = validateDeliveryPayload(body.data);
  if (!validation.ok) return jsonError(validation.error, 400);

  const payload = body.data as DeliveryPayload;
  const records = await readServerRecords();
  const record = createDeliveryRecord(payload);
  await writeServerRecords([record, ...records]);
  return NextResponse.json({ record }, { status: 201 });
}

export async function PUT(request: Request) {
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const validation = validateDeliveryPayload(body.data);
  if (!validation.ok) return jsonError(validation.error, 400);

  const payload = body.data as DeliveryPayload;
  if (!payload.id) {
    return jsonError("缺少记录 ID", 400);
  }

  const records = await readServerRecords();
  if (!records.some((record) => record.id === payload.id)) {
    return jsonError("记录不存在", 404);
  }

  const updated = createDeliveryRecord({ ...payload, updatedAt: new Date().toISOString() });
  await writeServerRecords(records.map((record) => (record.id === payload.id ? updated : record)));
  return NextResponse.json({ record: updated });
}

export async function DELETE(request: Request) {
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const { id } = body.data as { id?: unknown };
  if (!id) {
    return jsonError("缺少记录 ID", 400);
  }

  if (typeof id !== "string") {
    return jsonError("记录 ID 必须是字符串", 400);
  }

  const records = await readServerRecords();
  if (!records.some((record) => record.id === id)) {
    return jsonError("记录不存在", 404);
  }

  await writeServerRecords(records.filter((record) => record.id !== id));
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const validation = validateDeliveryPayloadArray(body.data);
  if (!validation.ok) return jsonError(validation.error, 400);

  const payloads = body.data as DeliveryPayload[];
  const records = await replaceServerRecords(payloads);
  return NextResponse.json({ records });
}
