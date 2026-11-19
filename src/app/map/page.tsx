import { getAllPhotos, getPhotoCollectionsMap, getSiteSettings } from "@/lib/queries";
import { MapClient } from "@/components/MapClient";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const [photos, collectionsMap, settings] = await Promise.all([
    getAllPhotos(),
    getPhotoCollectionsMap(),
    getSiteSettings(),
  ]);

  return (
    <MapClient
      photos={photos}
      collectionsMap={collectionsMap}
      settings={settings}
    />
  );
}
