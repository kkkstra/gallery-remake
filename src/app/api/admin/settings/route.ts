import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { db, ensureDb } from "@/lib/db";
import { siteSettings } from "@/lib/db/schema";
import { getSiteSettings } from "@/lib/queries";

export async function GET(req: Request) {
  if (!(await isAdminAuthenticated(req))) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  const settings = await getSiteSettings();
  return NextResponse.json({ settings });
}

export async function PUT(req: Request) {
  if (!(await isAdminAuthenticated(req))) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  await ensureDb();
  const body = (await req.json()) as Record<string, string>;
  for (const [key, value] of Object.entries(body)) {
    if (key === "initialized") continue;
    await db
      .insert(siteSettings)
      .values({ key, value: String(value ?? "") })
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: { value: String(value ?? "") },
      });
  }
  return NextResponse.json({ ok: true });
}
