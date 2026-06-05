import { NextResponse } from "next/server";

function readBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization) return undefined;

  const [scheme, token] = authorization.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) return undefined;
  return token;
}

export function requireAdminRequest(request: Request): Response | undefined {
  const expectedToken = process.env.ADMIN_API_TOKEN;
  if (!expectedToken) return undefined;

  const actualToken = readBearerToken(request) ?? request.headers.get("x-admin-token") ?? undefined;
  if (actualToken === expectedToken) return undefined;

  return NextResponse.json({ error: "未授权访问" }, { status: 401 });
}
