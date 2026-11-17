import path from "node:path";
import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { db, ensureDb } from "@/lib/db";
import { collectionPhotos, photos } from "@/lib/db/schema";
import { extractExifFromBuffer } from "@/lib/exif";
import { storeUploadedFile } from "@/lib/storage";

export async function POST(req: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  await ensureDb();

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "缺少图片文件" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const url = await storeUploadedFile(buffer, file.name, file.type);
  const exif = extractExifFromBuffer(buffer);

  const clientWidth = Number(form.get("width") || 0) || undefined;
  const clientHeight = Number(form.get("height") || 0) || undefined;
  const ambient = String(form.get("ambient") || "#1e2024");
  const category = String(form.get("category") || "landscape");
  const featured = form.get("featured") === "true";
  const collectionId = Number(form.get("collectionId") || 0);

  const rawTitle = path.basename(file.name, path.extname(file.name)).replace(/[-_]+/g, " ").trim();

  const [created] = await db
    .insert(photos)
    .values({
      title: rawTitle || "未命名作品",
      titleEn: "",
      description: "",
      descriptionEn: "",
      url,
      width: exif.width || clientWidth || 1600,
      height: exif.height || clientHeight || 1068,
      ambient,
      category,
      featured,
      sortOrder: 0,
      takenAt: exif.takenAt,
      location: "",
      locationEn: "",
      lat: exif.lat,
      lng: exif.lng,
      camera: exif.camera,
      lens: exif.lens,
      focalMm: exif.focalMm,
      aperture: exif.aperture,
      shutter: exif.shutter,
      iso: exif.iso,
      createdAt: new Date().toISOString(),
    })
    .returning();

  if (collectionId > 0 && created) {
    await db
      .insert(collectionPhotos)
      .values({ collectionId, photoId: created.id, sortOrder: 0 })
      .onConflictDoNothing();
  }

  return NextResponse.json({ photo: created });
}
