import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { readServerAdminPasswordHash } from "@/lib/data/server-store";

const PASSWORD_HASH_ALGORITHM = "scrypt";
const PASSWORD_SALT_BYTES = 16;
const PASSWORD_KEY_BYTES = 64;
const MINIMUM_PASSWORD_LENGTH = 8;
const DEFAULT_ADMIN_PASSWORD = "123456";

type AdminCredential = {
  source: "database" | "environment";
  sessionSecret: string;
  passwordHash?: string;
  password?: string;
};

function derivePasswordKey(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, PASSWORD_KEY_BYTES, (error, key) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(Buffer.from(key));
    });
  });
}

function safeEqualText(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

/** 校验新密码的长度与类型，不允许保存弱密码或非文本输入。 */
export function validateAdminPassword(value: unknown): { ok: true; password: string } | { ok: false; error: string } {
  if (typeof value !== "string") return { ok: false, error: "管理员密码必须是字符串" };
  if (value.length < MINIMUM_PASSWORD_LENGTH) return { ok: false, error: `管理员密码至少需要 ${MINIMUM_PASSWORD_LENGTH} 位` };
  if (value.length > 128) return { ok: false, error: "管理员密码不能超过 128 位" };
  return { ok: true, password: value };
}

/** 生成带随机盐的 scrypt 密码哈希，禁止在数据库中保存明文。 */
export async function hashAdminPassword(password: string) {
  const salt = randomBytes(PASSWORD_SALT_BYTES);
  const key = await derivePasswordKey(password, salt);
  return `${PASSWORD_HASH_ALGORITHM}$${salt.toString("base64")}$${key.toString("base64")}`;
}

async function verifyPasswordHash(password: string, passwordHash: string) {
  const [algorithm, encodedSalt, encodedKey] = passwordHash.split("$");
  if (algorithm !== PASSWORD_HASH_ALGORITHM || !encodedSalt || !encodedKey) return false;

  try {
    const expectedKey = Buffer.from(encodedKey, "base64");
    const derivedKey = await derivePasswordKey(password, Buffer.from(encodedSalt, "base64"));
    return expectedKey.length === derivedKey.length && timingSafeEqual(expectedKey, derivedKey);
  } catch {
    return false;
  }
}

/** 数据库密码优先，环境变量或默认密码仅作为首次初始化凭据。 */
export async function getAdminCredential(): Promise<AdminCredential | undefined> {
  const passwordHash = await readServerAdminPasswordHash();
  if (passwordHash) return { source: "database", passwordHash, sessionSecret: passwordHash };

  const password = process.env.ADMIN_API_TOKEN?.trim() || DEFAULT_ADMIN_PASSWORD;
  return { source: "environment", password, sessionSecret: password };
}

/** 使用当前凭据验证管理员输入，支持数据库哈希和环境变量引导密码。 */
export async function verifyAdminPassword(password: string, credential: AdminCredential) {
  if (credential.passwordHash) return verifyPasswordHash(password, credential.passwordHash);
  return safeEqualText(password, credential.password ?? "");
}
