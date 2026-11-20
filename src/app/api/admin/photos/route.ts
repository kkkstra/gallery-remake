import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { isAdminAuthenticated } from "@/lib/auth";
import { db, ensureDb } from "@/lib/db";
import { collectionPhotos, photos } from "@/lib/db/schema";
import { getAllPhotos } from "@/lib/queries";

export async function GET(req: Request) {
  if (!(await isAdminAuthenticated(req))) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const hiddenParam = searchParams.get("hidden");
  const featuredParam = searchParams.get("featured");
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const limit = Number(searchParams.get("limit") || 0);

  let list = await getAllPhotos({ includeHidden: true });
  if (category) list = list.filter((p) => p.category === category);
  if (hiddenParam === "true" || hiddenParam === "false") {
    const want = hiddenParam === "true";
    list = list.filter((p) => Boolean(p.hidden) === want);
  }
  if (featuredParam === "true" || featuredParam === "false") {
    const want = featuredParam === "true";
    list = list.filter((p) => Boolean(p.featured) === want);
  }
  if (q) {
    list = list.filter((p) =>
      `${p.title} ${p.titleEn} ${p.location} ${p.locationEn} ${p.camera} ${p.lens} ${p.description}`
        .toLowerCase()
        .includes(q)
    );
  }
  if (limit > 0) list = list.slice(0, limit);

  return NextResponse.json({ total: list.length, photos: list });
}

export async function POST(req: Request) {
  if (!(await isAdminAuthenticated(req))) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  await ensureDb();
  const body = await req.json();
  if (!body.url || !body.title) {
    return NextResponse.json({ error: "请填写标题和图片地址" }, { status: 400 });
  }

  const [created] = await db
    .insert(photos)
    .values({
      title: String(body.title),
      titleEn: String(body.titleEn || ""),
      description: String(body.description || ""),
      descriptionEn: String(body.descriptionEn || ""),
      url: String(body.url),
      width: Number(body.width) || 1600,
      height: Number(body.height) || 1068,
      ambient: String(body.ambient || "#1e2024"),
      blurData: String(body.blurData || ""),
      category: String(body.category || "landscape"),
      featured: Boolean(body.featured),
      hidden: Boolean(body.hidden),
      sortOrder: Number(body.sortOrder) || 0,
      takenAt: String(body.takenAt || ""),
      location: String(body.location || ""),
      locationEn: String(body.locationEn || ""),
      lat: body.lat !== "" && body.lat !== null && body.lat !== undefined ? Number(body.lat) : null,
      lng: body.lng !== "" && body.lng !== null && body.lng !== undefined ? Number(body.lng) : null,
      camera: String(body.camera || ""),
      lens: String(body.lens || ""),
      focalMm: body.focalMm ? Number(body.focalMm) : null,
      aperture: String(body.aperture || ""),
      shutter: String(body.shutter || ""),
      iso: body.iso ? Number(body.iso) : null,
      createdAt: new Date().toISOString(),
    })
    .returning();

  if (Array.isArray(body.collectionIds) && created) {
    for (const cid of body.collectionIds) {
      await db
        .insert(collectionPhotos)
        .values({ collectionId: Number(cid), photoId: created.id, sortOrder: 0 })
        .onConflictDoNothing();
    }
  }

  return NextResponse.json({ photo: created });
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
        .update(photos)
        .set({ sortOrder: i + 1 })
        .where(eq(photos.id, Number(orderedIds[i])));
    }
  }
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  await ensureDb();
  const body = await req.json();
  const ids: number[] = Array.isArray(body.ids)
    ? body.ids.map(Number).filter((n: number) => Number.isFinite(n) && n > 0)
    : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: "未选择作品" }, { status: 400 });
  }

  const action = String(body.action || "");
  if (action === "category" && body.value) {
    await db.update(photos).set({ category: String(body.value) }).where(inArray(photos.id, ids));
  } else if (action === "featured") {
    await db.update(photos).set({ featured: Boolean(body.value) }).where(inArray(photos.id, ids));
  } else if (action === "hidden") {
    await db.update(photos).set({ hidden: Boolean(body.value) }).where(inArray(photos.id, ids));
  } else if (action === "collection" && Number(body.value) > 0) {
    const colId = Number(body.value);
    for (const pid of ids) {
      await db
        .insert(collectionPhotos)
        .values({ collectionId: colId, photoId: pid, sortOrder: 0 })
        .onConflictDoNothing();
    }
  } else if (action === "delete") {
    await db.delete(collectionPhotos).where(inArray(collectionPhotos.photoId, ids));
    await db.delete(photos).where(inArray(photos.id, ids));
  }

  return NextResponse.json({ ok: true, count: ids.length });
}
