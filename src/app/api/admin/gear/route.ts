import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { isAdminAuthenticated } from "@/lib/auth";
import { db, ensureDb } from "@/lib/db";
import { gear } from "@/lib/db/schema";

export async function POST(req: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  await ensureDb();
  const body = await req.json();
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

  return NextResponse.json({ gear: created });
}

export async function PATCH(req: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  await ensureDb();
  const body = await req.json();
  const id = Number(body.id);
  if (!id || !body.name) {
    return NextResponse.json({ error: "参数不完整" }, { status: 400 });
  }
  await db
    .update(gear)
    .set({
      type: body.type === "lens" ? "lens" : "camera",
      brand: String(body.brand || ""),
      name: String(body.name),
      specs: String(body.specs || ""),
      note: String(body.note || ""),
      noteEn: String(body.noteEn || ""),
    })
    .where(eq(gear.id, id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  await ensureDb();
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (id) await db.delete(gear).where(eq(gear.id, id));
  return NextResponse.json({ ok: true });
}
