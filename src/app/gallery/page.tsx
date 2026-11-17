import { Suspense } from "react";
import { getAllPhotos, getPhotoCollectionsMap, getSiteSettings } from "@/lib/queries";
import { GalleryClient } from "@/components/GalleryClient";

export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const [photos, collectionsMap, settings] = await Promise.all([
    getAllPhotos(),
    getPhotoCollectionsMap(),
    getSiteSettings(),
  ]);

  return (
    <Suspense fallback={<div className="min-h-dvh bg-[var(--bg)]" />}>
      <GalleryClient photos={photos} collectionsMap={collectionsMap} settings={settings} />
    </Suspense>
  );
}
