import { NextResponse } from "next/server";
import { createDeliveryRecord } from "@/lib/data/normalize";
import { readServerRecords, replaceServerRecords, writeServerRecords } from "@/lib/data/server-store";
import type { DeliveryPayload } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const records = await readServerRecords();
  return NextResponse.json({ records });
}

export async function POST(request: Request) {
  const payload = (await request.json()) as DeliveryPayload;
  const records = await readServerRecords();
  const record = createDeliveryRecord(payload);
  await writeServerRecords([record, ...records]);
  return NextResponse.json({ record }, { status: 201 });
}

export async function PUT(request: Request) {
  const payload = (await request.json()) as DeliveryPayload;
  if (!payload.id) {
    return NextResponse.json({ error: "缺少记录 ID" }, { status: 400 });
  }

  const records = await readServerRecords();
  const updated = createDeliveryRecord({ ...payload, updatedAt: new Date().toISOString() });
  await writeServerRecords(records.map((record) => (record.id === payload.id ? updated : record)));
  return NextResponse.json({ record: updated });
}

export async function DELETE(request: Request) {
  const { id } = (await request.json()) as { id?: string };
  if (!id) {
    return NextResponse.json({ error: "缺少记录 ID" }, { status: 400 });
  }

  await writeServerRecords((await readServerRecords()).filter((record) => record.id !== id));
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const payloads = (await request.json()) as DeliveryPayload[];
  const records = await replaceServerRecords(payloads);
  return NextResponse.json({ records });
}
