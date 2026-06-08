import { NextResponse } from "next/server";
import {
  clearAdminSessionCookie,
  getAdminAuthStatus,
  setAdminSessionCookie,
} from "@/lib/api/admin-auth";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function GET(request: Request) {
  const status = getAdminAuthStatus(request);
  return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const expectedToken = process.env.ADMIN_API_TOKEN;
  if (!expectedToken) {
    if (process.env.VERCEL || process.env.NODE_ENV === "production") {
      return jsonError("管理接口未配置 ADMIN_API_TOKEN", 500);
    }

    // 本地开发未配置密码时直接视为已解锁，生产环境仍然 fail-closed。
    return NextResponse.json({ configured: false, unlocked: true });
  }

  let token: unknown;
  try {
    const body = (await request.json()) as { token?: unknown };
    token = body.token;
  } catch {
    return jsonError("请求 JSON 格式错误", 400);
  }

  if (typeof token !== "string" || token !== expectedToken) {
    return jsonError("密码错误", 401);
  }

  const response = NextResponse.json({ configured: true, unlocked: true });
  setAdminSessionCookie(response, expectedToken);
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ unlocked: false });
  clearAdminSessionCookie(response);
  return response;
}
