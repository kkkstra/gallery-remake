import { NextResponse } from "next/server";
import { asc, eq, inArray } from "drizzle-orm";
import { isAdminAuthenticated } from "@/lib/auth";
import { db, ensureDb } from "@/lib/db";
import { collectionPhotos, photos } from "@/lib/db/schema";
import { generateGroupId } from "@/lib/photo-groups";
import { getAllPhotos, invalidateGalleryCache } from "@/lib/queries";

async function normalizeOrCleanupGroups(groupIds: string[]) {
  const unique = Array.from(new Set(groupIds.filter(Boolean)));
  for (const gid of unique) {
    const remaining = await db
      .select()
      .from(photos)
      .where(eq(photos.groupId, gid))
      .orderBy(asc(photos.groupOrder), asc(photos.id));
    if (remaining.length <= 1) {
      if (remaining.length === 1) {
        await db
          .update(photos)
          .set({ groupId: "", groupOrder: 0, groupExpanded: false })
          .where(eq(photos.id, remaining[0].id));
      }
    } else {
      await Promise.all(
        remaining.map((p, i) =>
          p.groupOrder !== i + 1
            ? db.update(photos).set({ groupOrder: i + 1 }).where(eq(photos.id, p.id))
            : Promise.resolve()
        )
      );
    }
  }
}

export async function GET(req: Request) {
  if (!(await isAdminAuthenticated(req))) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const hiddenParam = searchParams.get("hidden");
  const featuredParam = searchParams.get("featured");
  const groupIdParam = searchParams.get("groupId");
  const nogpsParam = searchParams.get("nogps");
  const unassignedParam = searchParams.get("unassigned");
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const limit = Number(searchParams.get("limit") || 0);

  let list = await getAllPhotos({ includeHidden: true });
  if (category) list = list.filter((p) => p.category === category);
  if (groupIdParam) list = list.filter((p) => p.groupId === groupIdParam);
  if (nogpsParam === "true") list = list.filter((p) => p.lat === null || p.lng === null);
  if (unassignedParam === "true") {
    await ensureDb();
    const links = await db.select({ photoId: collectionPhotos.photoId }).from(collectionPhotos);
    const assigned = new Set(links.map((l) => l.photoId));
    list = list.filter((p) => !assigned.has(p.id));
  }
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
      groupId: String(body.groupId || ""),
      groupOrder: Number(body.groupOrder) || 0,
      groupExpanded: Boolean(body.groupExpanded),
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

  invalidateGalleryCache();
  return NextResponse.json({ photo: created });
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
          .update(photos)
          .set({ sortOrder: i + 1 })
          .where(eq(photos.id, Number(id)))
      )
    );
  }
  invalidateGalleryCache();
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  if (!(await isAdminAuthenticated(req))) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  await ensureDb();
  const body = await req.json();
  const action = String(body.action || "");
  const ids: number[] = Array.isArray(body.ids)
    ? body.ids.map(Number).filter((n: number) => Number.isFinite(n) && n > 0)
    : [];

  if (action === "group_ungroup" && body.groupId) {
    await db
      .update(photos)
      .set({ groupId: "", groupOrder: 0, groupExpanded: false })
      .where(eq(photos.groupId, String(body.groupId)));
    invalidateGalleryCache();
    return NextResponse.json({ ok: true });
  }

  if (ids.length === 0) {
    return NextResponse.json({ error: "未选择作品" }, { status: 400 });
  }

  if (action === "group_merge") {
    const selectedRows = await db.select().from(photos).where(inArray(photos.id, ids));
    const existingGroupIds = Array.from(new Set(selectedRows.map((p) => p.groupId).filter(Boolean)));
    const extraGroupRows =
      existingGroupIds.length > 0
        ? await db.select().from(photos).where(inArray(photos.groupId, existingGroupIds))
        : [];

    const rowMap = new Map<number, (typeof selectedRows)[number]>();
    selectedRows.forEach((r) => rowMap.set(r.id, r));
    extraGroupRows.forEach((r) => rowMap.set(r.id, r));

    // Preserve explicit `ids` order first, then any existing group siblings sorted by groupOrder
    const ordered: (typeof selectedRows)[number][] = [];
    const seen = new Set<number>();
    for (const id of ids) {
      const r = rowMap.get(id);
      if (r && !seen.has(r.id)) {
        ordered.push(r);
        seen.add(r.id);
      }
    }
    const leftovers = Array.from(rowMap.values())
      .filter((r) => !seen.has(r.id))
      .sort((a, b) => a.groupOrder - b.groupOrder || a.id - b.id);
    ordered.push(...leftovers);

    if (ordered.length < 2) {
      return NextResponse.json({ error: "组图至少需要选择 2 幅作品" }, { status: 400 });
    }

    const anchor = ordered[0];
    const targetGroupId = anchor.groupId || existingGroupIds[0] || generateGroupId();
    const anchorLinks = await db
      .select()
      .from(collectionPhotos)
      .where(eq(collectionPhotos.photoId, anchor.id));

    await Promise.all(
      ordered.map((member, idx) =>
        db
          .update(photos)
          .set({
            groupId: targetGroupId,
            groupOrder: idx + 1,
            groupExpanded: Boolean(anchor.groupExpanded),
            title: anchor.title,
            titleEn: anchor.titleEn,
            description: anchor.description,
            descriptionEn: anchor.descriptionEn,
            category: anchor.category,
            location: anchor.location,
            locationEn: anchor.locationEn,
            lat: anchor.lat,
            lng: anchor.lng,
          })
          .where(eq(photos.id, member.id))
      )
    );

    if (anchorLinks.length > 0) {
      for (const member of ordered) {
        for (const link of anchorLinks) {
          await db
            .insert(collectionPhotos)
            .values({ collectionId: link.collectionId, photoId: member.id, sortOrder: link.sortOrder })
            .onConflictDoNothing();
        }
      }
    }

    invalidateGalleryCache();
    return NextResponse.json({ ok: true, groupId: targetGroupId, count: ordered.length });
  }

  if (action === "group_reorder") {
    await Promise.all(
      ids.map((pid, idx) =>
        db
          .update(photos)
          .set({ groupOrder: idx + 1 })
          .where(eq(photos.id, pid))
      )
    );
    invalidateGalleryCache();
    return NextResponse.json({ ok: true, count: ids.length });
  }

  if (action === "group_remove" || action === "group_ungroup") {
    const targetRows = await db.select().from(photos).where(inArray(photos.id, ids));
    const affectedGroups = targetRows.map((r) => r.groupId).filter(Boolean);
    await db
      .update(photos)
      .set({ groupId: "", groupOrder: 0, groupExpanded: false })
      .where(inArray(photos.id, ids));
    if (action === "group_remove") {
      await normalizeOrCleanupGroups(affectedGroups);
    } else if (affectedGroups.length > 0) {
      await db
        .update(photos)
        .set({ groupId: "", groupOrder: 0, groupExpanded: false })
        .where(inArray(photos.groupId, affectedGroups));
    }
    invalidateGalleryCache();
    return NextResponse.json({ ok: true, count: ids.length });
  }

  // Expand group siblings for shared attributes (`category`, `collection`)
  let effectiveIds = ids;
  if (action === "category" || action === "collection") {
    const selectedRows = await db.select().from(photos).where(inArray(photos.id, ids));
    const gids = Array.from(new Set(selectedRows.map((r) => r.groupId).filter(Boolean)));
    if (gids.length > 0) {
      const sibs = await db.select({ id: photos.id }).from(photos).where(inArray(photos.groupId, gids));
      effectiveIds = Array.from(new Set([...ids, ...sibs.map((s) => s.id)]));
    }
  }

  if (action === "category" && body.value) {
    await db.update(photos).set({ category: String(body.value) }).where(inArray(photos.id, effectiveIds));
  } else if (action === "featured") {
    await db.update(photos).set({ featured: Boolean(body.value) }).where(inArray(photos.id, ids));
  } else if (action === "hidden") {
    await db.update(photos).set({ hidden: Boolean(body.value) }).where(inArray(photos.id, ids));
  } else if (action === "collection" && Number(body.value) > 0) {
    const colId = Number(body.value);
    for (const pid of effectiveIds) {
      await db
        .insert(collectionPhotos)
        .values({ collectionId: colId, photoId: pid, sortOrder: 0 })
        .onConflictDoNothing();
    }
  } else if (action === "delete") {
    const deletingRows = await db.select().from(photos).where(inArray(photos.id, ids));
    const affectedGroups = deletingRows.map((r) => r.groupId).filter(Boolean);
    await db.delete(collectionPhotos).where(inArray(collectionPhotos.photoId, ids));
    await db.delete(photos).where(inArray(photos.id, ids));
    await normalizeOrCleanupGroups(affectedGroups);
  }

  invalidateGalleryCache();
  return NextResponse.json({ ok: true, count: effectiveIds.length });
}
