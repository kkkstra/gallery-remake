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

async function upsertSettings(req: Request) {
  if (!(await isAdminAuthenticated(req))) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  await ensureDb();
  const body = (await req.json()) as Record<string, unknown>;
  const normalized: Record<string, string> = {};

  for (const [rawKey, rawVal] of Object.entries(body)) {
    if (rawKey === "initialized" || rawKey.startsWith("schema_v")) continue;
    if (rawKey === "aboutFocus" && Array.isArray(rawVal)) {
      normalized.aboutFocusJson = JSON.stringify(rawVal);
      continue;
    }
    if (rawKey === "aboutMilestones" && Array.isArray(rawVal)) {
      normalized.aboutMilestonesJson = JSON.stringify(rawVal);
      continue;
    }
    if (Array.isArray(rawVal) || (rawVal !== null && typeof rawVal === "object")) {
      normalized[rawKey] = JSON.stringify(rawVal);
    } else {
      normalized[rawKey] = String(rawVal ?? "");
    }
  }

  await Promise.all(
    Object.entries(normalized).map(([key, value]) =>
      db
        .insert(siteSettings)
        .values({ key, value })
        .onConflictDoUpdate({
          target: siteSettings.key,
          set: { value },
        })
    )
  );
  invalidateGalleryCache();
  return NextResponse.json({ ok: true });
}

export const PUT = upsertSettings;
export const PATCH = upsertSettings;
