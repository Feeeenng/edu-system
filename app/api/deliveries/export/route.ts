import { exportDeliveriesToCsv } from "@/lib/csv/export";
import { readServerRecords } from "@/lib/data/server-store";

export async function GET() {
  const csv = exportDeliveriesToCsv(await readServerRecords());
  return new Response(csv, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=deliveries.csv",
    },
  });
}

export async function POST() {
  return new Response(null, { status: 405 });
}
