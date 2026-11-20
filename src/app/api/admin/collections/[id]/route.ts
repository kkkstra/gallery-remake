import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { isAdminAuthenticated } from "@/lib/auth";
import { db, ensureDb } from "@/lib/db";
import { collectionPhotos, collections } from "@/lib/db/schema";
import { getCollectionsWithPhotos, invalidateGalleryCache, setCollectionPhotoIds } from "@/lib/queries";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated(req))) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  const id = Number((await params).id);
  const all = await getCollectionsWithPhotos({ includeHidden: true });
  const col = all.find((c) => c.id === id);
  if (!col) return NextResponse.json({ error: "未找到影集" }, { status: 404 });
  return NextResponse.json({ collection: col });
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
  if ("slug" in body && body.slug) patch.slug = String(body.slug).trim();
  if ("title" in body) patch.title = String(body.title ?? "");
  if ("titleEn" in body) patch.titleEn = String(body.titleEn ?? "");
  if ("description" in body) patch.description = String(body.description ?? "");
  if ("descriptionEn" in body) patch.descriptionEn = String(body.descriptionEn ?? "");
  if ("coverUrl" in body) patch.coverUrl = String(body.coverUrl ?? "");
  if ("period" in body) patch.period = String(body.period ?? "");
  if (typeof body.blocksJson === "string") patch.blocksJson = body.blocksJson;
  if ("sortOrder" in body) patch.sortOrder = Number(body.sortOrder) || 0;

  if (Object.keys(patch).length > 0) {
    await db.update(collections).set(patch).where(eq(collections.id, id));
  }

  if (Array.isArray(body.photoIds)) {
    await setCollectionPhotoIds(id, body.photoIds.map(Number));
  }

  invalidateGalleryCache();
  return NextResponse.json({ ok: true });
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
  await db.delete(collectionPhotos).where(eq(collectionPhotos.collectionId, id));
  await db.delete(collections).where(eq(collections.id, id));
  invalidateGalleryCache();
  return NextResponse.json({ ok: true });
}
