import { NextResponse } from "next/server";
import { asc, eq, inArray } from "drizzle-orm";
import { isAdminAuthenticated } from "@/lib/auth";
import { db, ensureDb } from "@/lib/db";
import { collectionPhotos, photos } from "@/lib/db/schema";
import { invalidateGalleryCache } from "@/lib/queries";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated(req))) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  await ensureDb();
  const id = Number((await params).id);
  const photo = await db.select().from(photos).where(eq(photos.id, id)).get();
  if (!photo) return NextResponse.json({ error: "未找到作品" }, { status: 404 });
  const links = await db.select().from(collectionPhotos).where(eq(collectionPhotos.photoId, id));
  return NextResponse.json({ photo, collectionIds: links.map((l) => l.collectionId) });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated(req))) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  await ensureDb();
  const id = Number((await params).id);
  const current = await db.select().from(photos).where(eq(photos.id, id)).get();
  if (!current) return NextResponse.json({ error: "未找到作品" }, { status: 404 });

  const body = await req.json();

  const sharedPatch: Record<string, unknown> = {};
  const framePatch: Record<string, unknown> = {};

  const sharedStrFields = [
    "title",
    "titleEn",
    "description",
    "descriptionEn",
    "category",
    "location",
    "locationEn",
  ] as const;

  const frameStrFields = [
    "url",
    "ambient",
    "takenAt",
    "camera",
    "lens",
    "aperture",
    "shutter",
    "groupId",
  ] as const;

  for (const key of sharedStrFields) {
    if (key in body) sharedPatch[key] = String(body[key] ?? "");
  }
  for (const key of frameStrFields) {
    if (key in body) framePatch[key] = String(body[key] ?? "");
  }

  if ("lat" in body) {
    sharedPatch.lat = body.lat === "" || body.lat === null ? null : Number(body.lat);
  }
  if ("lng" in body) {
    sharedPatch.lng = body.lng === "" || body.lng === null ? null : Number(body.lng);
  }
  if ("groupExpanded" in body) {
    sharedPatch.groupExpanded = Boolean(body.groupExpanded);
  }

  if ("width" in body) framePatch.width = Number(body.width) || 1600;
  if ("height" in body) framePatch.height = Number(body.height) || 1068;
  if ("featured" in body) framePatch.featured = Boolean(body.featured);
  if ("hidden" in body) framePatch.hidden = Boolean(body.hidden);
  if ("sortOrder" in body) framePatch.sortOrder = Number(body.sortOrder) || 0;
  if ("groupOrder" in body) framePatch.groupOrder = Number(body.groupOrder) || 0;
  if ("focalMm" in body) framePatch.focalMm = body.focalMm ? Number(body.focalMm) : null;
  if ("iso" in body) framePatch.iso = body.iso ? Number(body.iso) : null;

  const targetGroupId =
    "groupId" in body ? String(body.groupId ?? "") : current.groupId;

  if (Object.keys(sharedPatch).length > 0) {
    if (targetGroupId) {
      await db.update(photos).set(sharedPatch).where(eq(photos.groupId, targetGroupId));
    } else {
      Object.assign(framePatch, sharedPatch);
    }
  }

  if (Object.keys(framePatch).length > 0) {
    await db.update(photos).set(framePatch).where(eq(photos.id, id));
  }

  if (Array.isArray(body.collectionIds)) {
    const syncTargetIds = targetGroupId
      ? (await db.select({ id: photos.id }).from(photos).where(eq(photos.groupId, targetGroupId))).map(
          (r) => r.id
        )
      : [id];

    if (syncTargetIds.length > 0) {
      await db.delete(collectionPhotos).where(inArray(collectionPhotos.photoId, syncTargetIds));
      for (const pid of syncTargetIds) {
        for (const cid of body.collectionIds) {
          await db
            .insert(collectionPhotos)
            .values({ collectionId: Number(cid), photoId: pid, sortOrder: 0 })
            .onConflictDoNothing();
        }
      }
    }
  }

  invalidateGalleryCache();
  const updated = await db.select().from(photos).where(eq(photos.id, id)).get();
  const groupPhotos =
    updated?.groupId
      ? await db
          .select()
          .from(photos)
          .where(eq(photos.groupId, updated.groupId))
          .orderBy(asc(photos.groupOrder), asc(photos.id))
      : [];
  return NextResponse.json({ photo: updated, groupPhotos });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated(req))) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  await ensureDb();
  const id = Number((await params).id);
  const existing = await db.select().from(photos).where(eq(photos.id, id)).get();
  await db.delete(collectionPhotos).where(eq(collectionPhotos.photoId, id));
  await db.delete(photos).where(eq(photos.id, id));

  if (existing?.groupId) {
    const remaining = await db
      .select()
      .from(photos)
      .where(eq(photos.groupId, existing.groupId))
      .orderBy(asc(photos.groupOrder), asc(photos.id));
    if (remaining.length === 1) {
      await db
        .update(photos)
        .set({ groupId: "", groupOrder: 0, groupExpanded: false })
        .where(eq(photos.id, remaining[0].id));
    } else if (remaining.length > 1) {
      await Promise.all(
        remaining.map((p, i) =>
          db.update(photos).set({ groupOrder: i + 1 }).where(eq(photos.id, p.id))
        )
      );
    }
  }

  invalidateGalleryCache();
  return NextResponse.json({ ok: true });
}
