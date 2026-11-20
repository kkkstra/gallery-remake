import { Suspense } from "react";
import { getAllPhotos, getPhotoCollectionsMap, getSiteSettings } from "@/lib/queries";
import { MapClient } from "@/components/MapClient";

export const revalidate = 300;

export default async function MapPage() {
  const [photos, collectionsMap, settings] = await Promise.all([
    getAllPhotos(),
    getPhotoCollectionsMap(),
    getSiteSettings(),
  ]);

  return (
    <Suspense fallback={<div className="min-h-dvh bg-[var(--bg)]" />}>
      <MapClient
        photos={photos}
        collectionsMap={collectionsMap}
        settings={settings}
      />
    </Suspense>
  );
}
