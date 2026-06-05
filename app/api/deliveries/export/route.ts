import { exportDeliveriesToCsv } from "@/lib/csv/export";
import { readServerRecords } from "@/lib/data/server-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const csv = exportDeliveriesToCsv(await readServerRecords());
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=deliveries.csv",
    },
  });
}
