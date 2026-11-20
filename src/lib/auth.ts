import { cookies, headers } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { db, ensureDb } from "./db";
import { siteSettings } from "./db/schema";

const COOKIE_NAME = "gallery_admin_session";

function getSecret() {
  const raw = process.env.JWT_SECRET || "gallery-remake-default-secret-change-in-prod";
  return new TextEncoder().encode(raw);
}

export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || "admin123";
}

export async function createAdminToken(): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());
}

export async function isAdminAuthenticated(req?: Request): Promise<boolean> {
  try {
    const hdrs = req ? req.headers : await headers();
    const authHeader = hdrs.get("authorization") || "";
    const apiKeyHeader = hdrs.get("x-api-key") || "";
    const candidate = authHeader.replace(/^Bearer\s+/i, "").trim() || apiKeyHeader.trim();

    if (candidate) {
      if (process.env.ADMIN_API_KEY && candidate === process.env.ADMIN_API_KEY) return true;
      if (candidate === getAdminPassword()) return true;
      await ensureDb();
      const savedKey = await db
        .select()
        .from(siteSettings)
        .where(eq(siteSettings.key, "apiKey"))
        .get();
      if (savedKey?.value && savedKey.value.length >= 8 && candidate === savedKey.value) {
        return true;
      }
      try {
        await jwtVerify(candidate, getSecret());
        return true;
      } catch {
        return false;
      }
    }
  } catch {
    // Fall through to cookie check
  }

  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, getSecret());
    return true;
  } catch {
    return false;
  }
}

export { COOKIE_NAME };
