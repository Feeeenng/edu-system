import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE_NAME = "edu-system.admin-session";

const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
const ADMIN_SESSION_MAX_AGE_MS = ADMIN_SESSION_MAX_AGE_SECONDS * 1000;

function shouldFailClosed() {
  return Boolean(process.env.VERCEL || process.env.NODE_ENV === "production");
}

function getRequestProtocol(request: Request) {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  if (forwardedProto) return forwardedProto;
  return new URL(request.url).protocol.replace(":", "");
}

function shouldUseSecureCookie(request: Request) {
  return process.env.VERCEL ? true : getRequestProtocol(request) === "https";
}

function readBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization) return undefined;

  const [scheme, token] = authorization.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) return undefined;
  return token;
}

function readCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return undefined;

  const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
  const targetCookie = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  if (!targetCookie) return undefined;

  const rawValue = targetCookie.slice(name.length + 1);
  try {
    return decodeURIComponent(rawValue);
  } catch {
    return rawValue;
  }
}

function signSession(timestamp: string, expectedToken: string) {
  return createHmac("sha256", expectedToken).update(timestamp).digest("hex");
}

function safeEqualHex(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createAdminSessionValue(expectedToken: string, now = Date.now()) {
  const timestamp = String(now);
  return `${timestamp}.${signSession(timestamp, expectedToken)}`;
}

export function isValidAdminSessionValue(value: string | undefined, expectedToken: string, now = Date.now()) {
  if (!value) return false;

  const parts = value.split(".");
  if (parts.length !== 2) return false;

  const [timestamp, signature] = parts;
  if (!timestamp || !signature) return false;

  const issuedAt = Number(timestamp);
  if (!Number.isFinite(issuedAt) || now - issuedAt > ADMIN_SESSION_MAX_AGE_MS || issuedAt > now + 60_000) {
    return false;
  }

  return safeEqualHex(signature, signSession(timestamp, expectedToken));
}

export function getAdminAuthStatus(request: Request) {
  const expectedToken = process.env.ADMIN_API_TOKEN;
  if (!expectedToken) {
    return {
      configured: false,
      unlocked: !shouldFailClosed(),
      failClosed: shouldFailClosed(),
    };
  }

  return {
    configured: true,
    unlocked: isValidAdminSessionValue(readCookie(request, ADMIN_SESSION_COOKIE_NAME), expectedToken),
    failClosed: false,
  };
}

export function setAdminSessionCookie(response: NextResponse, request: Request, expectedToken: string) {
  response.cookies.set(ADMIN_SESSION_COOKIE_NAME, createAdminSessionValue(expectedToken), {
    httpOnly: true,
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: shouldUseSecureCookie(request),
  });
}

export function clearAdminSessionCookie(response: NextResponse, request: Request) {
  response.cookies.set(ADMIN_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: shouldUseSecureCookie(request),
  });
}

export function requireAdminRequest(request: Request): Response | undefined {
  const expectedToken = process.env.ADMIN_API_TOKEN;
  if (!expectedToken && shouldFailClosed()) {
    return NextResponse.json({ error: "管理接口未配置 ADMIN_API_TOKEN" }, { status: 500 });
  }

  if (!expectedToken) return undefined;

  const actualToken = readBearerToken(request) ?? request.headers.get("x-admin-token") ?? undefined;
  if (actualToken === expectedToken) return undefined;

  if (isValidAdminSessionValue(readCookie(request, ADMIN_SESSION_COOKIE_NAME), expectedToken)) return undefined;

  return NextResponse.json({ error: "未授权访问" }, { status: 401 });
}
