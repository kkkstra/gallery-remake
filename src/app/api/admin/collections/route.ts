import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { isAdminAuthenticated } from "@/lib/auth";
import { db, ensureDb } from "@/lib/db";
import { collections } from "@/lib/db/schema";
import {
  applyPhotoTitleOverrides,
  parseMonographBlocks,
  sanitizeRawMonographBlocks,
  serializeAdminCollection,
  type PhotoTitleOverrideInput,
} from "@/lib/monograph";
import { getCollectionsWithPhotos, invalidateGalleryCache, setCollectionPhotoIds } from "@/lib/queries";

export async function GET(req: Request) {
  if (!(await isAdminAuthenticated(req))) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  const list = await getCollectionsWithPhotos({ includeHidden: true });
  return NextResponse.json({ collections: list.map(serializeAdminCollection) });
}

export async function POST(req: Request) {
  if (!(await isAdminAuthenticated(req))) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  await ensureDb();
  const body = await req.json();
  const slug = String(body.slug || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-|-$/g, "");
  if (!slug || !body.title) {
    return NextResponse.json({ error: "请填写标题和英文路径标识(slug)" }, { status: 400 });
  }

  let normalizedBlocks = Array.isArray(body.blocks)
    ? sanitizeRawMonographBlocks(body.blocks)
    : typeof body.blocksJson === "string" && body.blocksJson.trim()
      ? (() => {
          try {
            const parsed = JSON.parse(body.blocksJson);
            return Array.isArray(parsed) ? sanitizeRawMonographBlocks(parsed) : null;
          } catch {
            return null;
          }
        })()
      : null;

  const explicitPhotoIds = Array.isArray(body.photoIds)
    ? body.photoIds.map(Number).filter((n: number) => Number.isFinite(n) && n > 0)
    : normalizedBlocks
      ? normalizedBlocks.filter((b) => b.kind === "photo").map((b) => b.photoId)
      : [];

  const [created] = await db
    .insert(collections)
    .values({
      slug,
      title: String(body.title),
      titleEn: String(body.titleEn || ""),
      description: String(body.description || ""),
      descriptionEn: String(body.descriptionEn || ""),
      coverUrl: String(body.coverUrl || ""),
      period: String(body.period || ""),
      blocksJson: normalizedBlocks ? JSON.stringify(normalizedBlocks) : "",
      sortOrder: Number(body.sortOrder) || 0,
    })
    .returning();

  if (created && explicitPhotoIds.length > 0) {
    await setCollectionPhotoIds(created.id, explicitPhotoIds);
  }

  invalidateGalleryCache();
  const all = await getCollectionsWithPhotos({ includeHidden: true });
  let full = created ? all.find((c) => c.id === created.id) ?? null : null;

  if (full && body.photoTitles && typeof body.photoTitles === "object" && !Array.isArray(body.photoTitles)) {
    normalizedBlocks = applyPhotoTitleOverrides(
      parseMonographBlocks(full.blocksJson, full),
      body.photoTitles as Record<string, PhotoTitleOverrideInput>
    );
    await db
      .update(collections)
      .set({ blocksJson: JSON.stringify(normalizedBlocks) })
      .where(eq(collections.id, full.id));
    invalidateGalleryCache();
    const refreshed = await getCollectionsWithPhotos({ includeHidden: true });
    full = refreshed.find((c) => c.id === full!.id) ?? full;
  }

  return NextResponse.json({ collection: full ? serializeAdminCollection(full) : created });
}

export async function PUT(req: Request) {
  if (!(await isAdminAuthenticated(req))) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  await ensureDb();
  const { orderedIds } = (await req.json()) as { orderedIds: number[] };
  if (Array.isArray(orderedIds)) {
    await Promise.all(
      orderedIds.map((id, i) =>
        db
          .update(collections)
          .set({ sortOrder: i + 1 })
          .where(eq(collections.id, Number(id)))
      )
    );
  }
  invalidateGalleryCache();
  return NextResponse.json({ ok: true });
}
