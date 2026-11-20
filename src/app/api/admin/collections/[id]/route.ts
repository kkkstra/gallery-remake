import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { isAdminAuthenticated } from "@/lib/auth";
import { db, ensureDb } from "@/lib/db";
import { collectionPhotos, collections } from "@/lib/db/schema";
import {
  applyPhotoTitleOverrides,
  parseMonographBlocks,
  sanitizeRawMonographBlocks,
  serializeAdminCollection,
  type PhotoTitleOverrideInput,
} from "@/lib/monograph";
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
  return NextResponse.json({ collection: serializeAdminCollection(col) });
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
  if ("sortOrder" in body) patch.sortOrder = Number(body.sortOrder) || 0;

  let incomingBlocks = Array.isArray(body.blocks)
    ? sanitizeRawMonographBlocks(body.blocks)
    : typeof body.blocksJson === "string"
      ? (() => {
          if (!body.blocksJson.trim()) return [];
          try {
            const parsed = JSON.parse(body.blocksJson);
            return Array.isArray(parsed) ? sanitizeRawMonographBlocks(parsed) : null;
          } catch {
            return null;
          }
        })()
      : null;

  if (incomingBlocks !== null) {
    patch.blocksJson = incomingBlocks.length > 0 ? JSON.stringify(incomingBlocks) : "";
  }

  if (Object.keys(patch).length > 0) {
    await db.update(collections).set(patch).where(eq(collections.id, id));
  }

  if (Array.isArray(body.photoIds)) {
    await setCollectionPhotoIds(
      id,
      body.photoIds.map(Number).filter((n: number) => Number.isFinite(n) && n > 0)
    );
  } else if (Array.isArray(body.blocks) && incomingBlocks) {
    await setCollectionPhotoIds(
      id,
      incomingBlocks.filter((b) => b.kind === "photo").map((b) => b.photoId)
    );
  }

  invalidateGalleryCache();
  let all = await getCollectionsWithPhotos({ includeHidden: true });
  let col = all.find((c) => c.id === id) ?? null;

  if (col && body.photoTitles && typeof body.photoTitles === "object" && !Array.isArray(body.photoTitles)) {
    const merged = applyPhotoTitleOverrides(
      parseMonographBlocks(col.blocksJson, col),
      body.photoTitles as Record<string, PhotoTitleOverrideInput>
    );
    await db
      .update(collections)
      .set({ blocksJson: JSON.stringify(merged) })
      .where(eq(collections.id, id));
    invalidateGalleryCache();
    all = await getCollectionsWithPhotos({ includeHidden: true });
    col = all.find((c) => c.id === id) ?? col;
  }

  return NextResponse.json({
    ok: true,
    collection: col ? serializeAdminCollection(col) : null,
  });
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
