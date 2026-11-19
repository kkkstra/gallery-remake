import { NextResponse } from "next/server";
import { getAllPhotos, getCollectionsWithPhotos } from "@/lib/queries";

export async function GET() {
  const [photos, collections] = await Promise.all([
    getAllPhotos(),
    getCollectionsWithPhotos(),
  ]);

  return NextResponse.json({
    photos: photos.map((p) => ({
      id: p.id,
      title: p.title,
      titleEn: p.titleEn,
      url: p.url,
      ambient: p.ambient,
      category: p.category,
      location: p.location,
      locationEn: p.locationEn,
      camera: p.camera,
      lens: p.lens,
      focalMm: p.focalMm,
      aperture: p.aperture,
      takenAt: p.takenAt,
    })),
    collections: collections.map((c) => ({
      slug: c.slug,
      title: c.title,
      titleEn: c.titleEn,
      period: c.period,
      coverUrl: c.coverUrl,
      photoCount: c.photoCount,
    })),
  });
}
