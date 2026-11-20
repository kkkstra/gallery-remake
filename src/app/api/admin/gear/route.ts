import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { isAdminAuthenticated } from "@/lib/auth";
import { db, ensureDb } from "@/lib/db";
import { gear } from "@/lib/db/schema";
import { getAllGear, getAllPhotos, invalidateGalleryCache } from "@/lib/queries";

export async function GET(req: Request) {
  if (!(await isAdminAuthenticated(req))) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  const items = await getAllGear({ includeHidden: true });
  return NextResponse.json({ gear: items });
}

export async function POST(req: Request) {
  if (!(await isAdminAuthenticated(req))) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  await ensureDb();
  const body = await req.json();

  if (body.action === "sync_from_exif") {
    const [existingGear, allPhotos] = await Promise.all([
      getAllGear({ includeHidden: true }),
      getAllPhotos({ includeHidden: true }),
    ]);
    const existingNames = new Set(existingGear.map((g) => g.name.toLowerCase()));
    const toCreate: { type: "camera" | "lens"; brand: string; name: string }[] = [];

    for (const p of allPhotos) {
      if (p.camera && !existingNames.has(p.camera.toLowerCase())) {
        existingNames.add(p.camera.toLowerCase());
        const brand = p.camera.trim().split(/\s+/)[0] || "";
        toCreate.push({ type: "camera", brand, name: p.camera });
      }
      if (p.lens && !existingNames.has(p.lens.toLowerCase())) {
        existingNames.add(p.lens.toLowerCase());
        const brand = p.camera ? p.camera.trim().split(/\s+/)[0] : "";
        toCreate.push({ type: "lens", brand, name: p.lens });
      }
    }

    const created = [];
    for (const item of toCreate) {
      const [row] = await db
        .insert(gear)
        .values({ ...item, specs: "", note: "", noteEn: "", sortOrder: 0 })
        .returning();
      if (row) created.push(row);
    }
    if (created.length > 0) invalidateGalleryCache();
    return NextResponse.json({ ok: true, importedCount: created.length, gear: created });
  }

  if (!body.name) {
    return NextResponse.json({ error: "请填写器材名称" }, { status: 400 });
  }

  const [created] = await db
    .insert(gear)
    .values({
      type: body.type === "lens" ? "lens" : "camera",
      brand: String(body.brand || ""),
      name: String(body.name),
      specs: String(body.specs || ""),
      note: String(body.note || ""),
      noteEn: String(body.noteEn || ""),
      sortOrder: Number(body.sortOrder) || 0,
    })
    .returning();

  invalidateGalleryCache();
  return NextResponse.json({ gear: created });
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
          .update(gear)
          .set({ sortOrder: i + 1 })
          .where(eq(gear.id, Number(id)))
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
  const id = Number(body.id);
  if (!id) {
    return NextResponse.json({ error: "缺少器材 ID" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if ("type" in body) patch.type = body.type === "lens" ? "lens" : "camera";
  if ("brand" in body) patch.brand = String(body.brand ?? "");
  if ("name" in body && body.name) patch.name = String(body.name);
  if ("specs" in body) patch.specs = String(body.specs ?? "");
  if ("note" in body) patch.note = String(body.note ?? "");
  if ("noteEn" in body) patch.noteEn = String(body.noteEn ?? "");
  if ("sortOrder" in body) patch.sortOrder = Number(body.sortOrder) || 0;

  if (Object.keys(patch).length > 0) {
    await db.update(gear).set(patch).where(eq(gear.id, id));
  }
  invalidateGalleryCache();
  const updated = await db.select().from(gear).where(eq(gear.id, id)).get();
  return NextResponse.json({ ok: true, gear: updated });
}

export async function DELETE(req: Request) {
  if (!(await isAdminAuthenticated(req))) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  await ensureDb();
  const { searchParams } = new URL(req.url);
  let id = Number(searchParams.get("id") || 0);
  if (!id) {
    const body = await req.json().catch(() => ({}));
    id = Number(body.id || 0);
  }
  if (id) await db.delete(gear).where(eq(gear.id, id));
  invalidateGalleryCache();
  return NextResponse.json({ ok: true });
}
