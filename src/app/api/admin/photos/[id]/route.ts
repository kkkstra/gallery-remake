import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
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
  const body = await req.json();

  const patch: Record<string, unknown> = {};
  const strFields = [
    "title",
    "titleEn",
    "description",
    "descriptionEn",
    "url",
    "ambient",
    "category",
    "takenAt",
    "location",
    "locationEn",
    "camera",
    "lens",
    "aperture",
    "shutter",
  ] as const;

  for (const key of strFields) {
    if (key in body) patch[key] = String(body[key] ?? "");
  }
  if ("width" in body) patch.width = Number(body.width) || 1600;
  if ("height" in body) patch.height = Number(body.height) || 1068;
  if ("featured" in body) patch.featured = Boolean(body.featured);
  if ("hidden" in body) patch.hidden = Boolean(body.hidden);
  if ("sortOrder" in body) patch.sortOrder = Number(body.sortOrder) || 0;
  if ("focalMm" in body) patch.focalMm = body.focalMm ? Number(body.focalMm) : null;
  if ("iso" in body) patch.iso = body.iso ? Number(body.iso) : null;
  if ("lat" in body) {
    patch.lat = body.lat === "" || body.lat === null ? null : Number(body.lat);
  }
  if ("lng" in body) {
    patch.lng = body.lng === "" || body.lng === null ? null : Number(body.lng);
  }

  if (Object.keys(patch).length > 0) {
    await db.update(photos).set(patch).where(eq(photos.id, id));
  }

  if (Array.isArray(body.collectionIds)) {
    await db.delete(collectionPhotos).where(eq(collectionPhotos.photoId, id));
    for (const cid of body.collectionIds) {
      await db
        .insert(collectionPhotos)
        .values({ collectionId: Number(cid), photoId: id, sortOrder: 0 })
        .onConflictDoNothing();
    }
  }

  invalidateGalleryCache();
  const updated = await db.select().from(photos).where(eq(photos.id, id)).get();
  return NextResponse.json({ photo: updated });
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
  await db.delete(collectionPhotos).where(eq(collectionPhotos.photoId, id));
  await db.delete(photos).where(eq(photos.id, id));
  invalidateGalleryCache();
  return NextResponse.json({ ok: true });
}
