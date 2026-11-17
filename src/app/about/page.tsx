import { getAllPhotos, getCollectionsWithPhotos, getSiteSettings } from "@/lib/queries";
import { AboutClient } from "@/components/AboutClient";

export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const [settings, photos, collections] = await Promise.all([
    getSiteSettings(),
    getAllPhotos(),
    getCollectionsWithPhotos(),
  ]);

  const locationCount = new Set(photos.map((p) => p.location).filter(Boolean)).size;

  return (
    <AboutClient
      settings={settings}
      stats={{
        photoCount: photos.length,
        collectionCount: collections.length,
        locationCount,
      }}
    />
  );
}
