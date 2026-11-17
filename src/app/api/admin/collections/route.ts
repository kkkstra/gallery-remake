import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { db, ensureDb } from "@/lib/db";
import { collections } from "@/lib/db/schema";
import { setCollectionPhotoIds } from "@/lib/queries";

export async function POST(req: Request) {
  if (!(await isAdminAuthenticated())) {
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
      sortOrder: Number(body.sortOrder) || 0,
    })
    .returning();

  if (Array.isArray(body.photoIds) && created) {
    await setCollectionPhotoIds(created.id, body.photoIds.map(Number));
  }

  return NextResponse.json({ collection: created });
}
