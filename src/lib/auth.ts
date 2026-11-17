import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

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

export async function isAdminAuthenticated(): Promise<boolean> {
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
