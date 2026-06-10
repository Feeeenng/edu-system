import { requireAdminRequest } from "@/lib/api/admin-auth";
import { readServerRecords } from "@/lib/data/server-store";
import { buildDeliveriesWorkbook } from "@/lib/excel/workbook";

export async function GET(request: Request) {
  const unauthorized = requireAdminRequest(request);
  if (unauthorized) return unauthorized;

  const workbook = buildDeliveriesWorkbook(await readServerRecords());
  return new Response(workbook, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=deliveries.xlsx",
    },
  });
}

export async function POST(request: Request) {
  const unauthorized = requireAdminRequest(request);
  if (unauthorized) return unauthorized;

  return new Response(null, { status: 405 });
}
