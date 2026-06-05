import { NextResponse } from "next/server";
import { parseDeliveryCsv } from "@/lib/csv/parse";
import { replaceServerRecords } from "@/lib/data/server-store";

export async function POST(request: Request) {
  const body = await request.text();
  const result = parseDeliveryCsv(body);
  if (result.errors.length > 0) {
    return NextResponse.json(result, { status: 400 });
  }

  if (result.records.length === 0) {
    return NextResponse.json({ records: [], errors: ["CSV 中没有可导入的数据"] }, { status: 400 });
  }

  const records = await replaceServerRecords(result.records);
  return NextResponse.json({ records, errors: [] });
}
