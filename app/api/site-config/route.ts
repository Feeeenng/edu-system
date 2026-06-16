import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/api/admin-auth";
import { readServerSiteConfig, writeServerSiteConfig } from "@/lib/data/server-store";
import { validateSiteConfigPayload } from "@/lib/site-config";

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
  const config = await readServerSiteConfig();
  return NextResponse.json({ config }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const validation = validateSiteConfigPayload(body.data);
  if (!validation.ok) return jsonError(validation.error, 400);

  const unauthorized = requireAdminRequest(request);
  if (unauthorized) return unauthorized;

  const config = await writeServerSiteConfig(validation.config);
  return NextResponse.json({ config });
}
