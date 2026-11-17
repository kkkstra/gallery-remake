import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { isAdminAuthenticated } from "@/lib/auth";
import { db, ensureDb } from "@/lib/db";
import { collectionPhotos, collections } from "@/lib/db/schema";
import { setCollectionPhotoIds } from "@/lib/queries";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  await ensureDb();
  const id = Number((await params).id);
  const body = await req.json();

  await db
    .update(collections)
    .set({
      slug: String(body.slug || "").trim(),
      title: String(body.title || ""),
      titleEn: String(body.titleEn || ""),
      description: String(body.description || ""),
      descriptionEn: String(body.descriptionEn || ""),
      coverUrl: String(body.coverUrl || ""),
      period: String(body.period || ""),
      sortOrder: Number(body.sortOrder) || 0,
    })
    .where(eq(collections.id, id));

  if (Array.isArray(body.photoIds)) {
    await setCollectionPhotoIds(id, body.photoIds.map(Number));
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  await ensureDb();
  const id = Number((await params).id);
  await db.delete(collectionPhotos).where(eq(collectionPhotos.collectionId, id));
  await db.delete(collections).where(eq(collections.id, id));
  return NextResponse.json({ ok: true });
}
