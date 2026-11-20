import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { isAdminAuthenticated } from "@/lib/auth";
import { db, ensureDb } from "@/lib/db";
import { collections } from "@/lib/db/schema";
import { getCollectionsWithPhotos, setCollectionPhotoIds } from "@/lib/queries";

export async function GET(req: Request) {
  if (!(await isAdminAuthenticated(req))) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  const list = await getCollectionsWithPhotos({ includeHidden: true });
  return NextResponse.json({ collections: list });
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
      blocksJson: typeof body.blocksJson === "string" ? body.blocksJson : "",
      sortOrder: Number(body.sortOrder) || 0,
    })
    .returning();

  if (Array.isArray(body.photoIds) && created) {
    await setCollectionPhotoIds(created.id, body.photoIds.map(Number));
  }

  return NextResponse.json({ collection: created });
}

export async function PUT(req: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  await ensureDb();
  const { orderedIds } = (await req.json()) as { orderedIds: number[] };
  if (Array.isArray(orderedIds)) {
    for (let i = 0; i < orderedIds.length; i++) {
      await db
        .update(collections)
        .set({ sortOrder: i + 1 })
        .where(eq(collections.id, Number(orderedIds[i])));
    }
  }
  return NextResponse.json({ ok: true });
}
