import { NextResponse } from "next/server";
import { getAdminCredential, hashAdminPassword, validateAdminPassword, verifyAdminPassword } from "@/lib/api/admin-credential";
import { requireAdminRequest, setAdminSessionCookie } from "@/lib/api/admin-auth";
import { writeServerAdminPasswordHash } from "@/lib/data/server-store";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

/** 在验证当前管理员身份后更新数据库中的管理员密码哈希。 */
export async function PUT(request: Request) {
  const unauthorized = await requireAdminRequest(request);
  if (unauthorized) return unauthorized;

  let body: { currentPassword?: unknown; newPassword?: unknown };
  try {
    body = (await request.json()) as { currentPassword?: unknown; newPassword?: unknown };
  } catch {
    return jsonError("请求 JSON 格式错误", 400);
  }

  const validation = validateAdminPassword(body.newPassword);
  if (!validation.ok) return jsonError(validation.error, 400);

  const credential = await getAdminCredential();
  if (credential) {
    if (typeof body.currentPassword !== "string" || !await verifyAdminPassword(body.currentPassword, credential)) {
      return jsonError("当前管理员密码不正确", 400);
    }
  }

  const passwordHash = await hashAdminPassword(validation.password);
  await writeServerAdminPasswordHash(passwordHash);

  const response = NextResponse.json({ configured: true, source: "database" });
  setAdminSessionCookie(response, request, passwordHash);
  return response;
}
