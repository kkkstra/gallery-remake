import { NextResponse } from "next/server";
import { COOKIE_NAME, createAdminToken, getAdminPassword } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (body.password !== getAdminPassword()) {
    return NextResponse.json({ error: "密码不正确" }, { status: 401 });
  }
  const token = await createAdminToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE_NAME);
  return res;
}
