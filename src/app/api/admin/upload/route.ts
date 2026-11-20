import path from "node:path";
import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { db, ensureDb } from "@/lib/db";
import { collectionPhotos, photos } from "@/lib/db/schema";
import { invalidateGalleryCache } from "@/lib/queries";
import { extractExifFromBuffer } from "@/lib/exif";
import { generateBlurDataUrl } from "@/lib/lqip";
import { storeUploadedFile } from "@/lib/storage";

export async function POST(req: Request) {
  if (!(await isAdminAuthenticated(req))) {
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

  const [url, blurData] = await Promise.all([
    storeUploadedFile(buffer, file.name, file.type),
    generateBlurDataUrl(buffer),
  ]);
  const exif = extractExifFromBuffer(buffer);

  const clientWidth = Number(form.get("width") || 0) || undefined;
  const clientHeight = Number(form.get("height") || 0) || undefined;
  const ambient = String(form.get("ambient") || "#1e2024");
  const category = String(form.get("category") || "landscape");
  const featured = form.get("featured") === "true";
  const hidden = form.get("hidden") === "true";
  const collectionId = Number(form.get("collectionId") || 0);
  const customTitle = String(form.get("title") || "").trim();
  const titleEn = String(form.get("titleEn") || "").trim();
  const description = String(form.get("description") || "").trim();
  const descriptionEn = String(form.get("descriptionEn") || "").trim();
  const location = String(form.get("location") || "").trim();
  const locationEn = String(form.get("locationEn") || "").trim();
  const rawLat = form.get("lat");
  const rawLng = form.get("lng");
  const pickedLat = rawLat !== null && rawLat !== "" && Number.isFinite(Number(rawLat)) ? Number(rawLat) : null;
  const pickedLng = rawLng !== null && rawLng !== "" && Number.isFinite(Number(rawLng)) ? Number(rawLng) : null;
  const overrideExif = form.get("overrideExif") === "true";

  const rawTitle = path.basename(file.name, path.extname(file.name)).replace(/[-_]+/g, " ").trim();

  const [created] = await db
    .insert(photos)
    .values({
      title: customTitle || rawTitle || "未命名作品",
      titleEn,
      description,
      descriptionEn,
      url,
      width: exif.width || clientWidth || 1600,
      height: exif.height || clientHeight || 1068,
      ambient,
      blurData,
      category,
      featured,
      hidden,
      sortOrder: 0,
      takenAt: String(form.get("takenAt") || "").trim() || exif.takenAt,
      location,
      locationEn,
      lat: overrideExif && pickedLat !== null ? pickedLat : exif.lat ?? pickedLat,
      lng: overrideExif && pickedLng !== null ? pickedLng : exif.lng ?? pickedLng,
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

  invalidateGalleryCache();
  return NextResponse.json({ photo: created });
}
