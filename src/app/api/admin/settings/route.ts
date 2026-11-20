import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { db, ensureDb } from "@/lib/db";
import { siteSettings } from "@/lib/db/schema";
import { fetchSiteSettingsFresh, invalidateGalleryCache } from "@/lib/queries";

export async function GET(req: Request) {
  if (!(await isAdminAuthenticated(req))) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  const settings = await fetchSiteSettingsFresh();
  return NextResponse.json({ settings });
}

export async function PUT(req: Request) {
  if (!(await isAdminAuthenticated(req))) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  await ensureDb();
  const body = (await req.json()) as Record<string, string>;
  const entries = Object.entries(body).filter(
    ([key]) => key !== "initialized" && key !== "schema_v3"
  );
  await Promise.all(
    entries.map(([key, value]) =>
      db
        .insert(siteSettings)
        .values({ key, value: String(value ?? "") })
        .onConflictDoUpdate({
          target: siteSettings.key,
          set: { value: String(value ?? "") },
        })
    )
  );
  invalidateGalleryCache();
  return NextResponse.json({ ok: true });
}
