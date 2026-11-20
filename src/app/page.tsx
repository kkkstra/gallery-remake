import {
  getAllPhotos,
  getCollectionsWithPhotos,
  getPhotoCollectionsMap,
  getSiteSettings,
} from "@/lib/queries";
import { HomeStageClient } from "@/components/HomeStageClient";

export const revalidate = 300;

export default async function HomePage() {
  const [allPhotos, collections, collectionsMap, settings] = await Promise.all([
    getAllPhotos(),
    getCollectionsWithPhotos(),
    getPhotoCollectionsMap(),
    getSiteSettings(),
  ]);

  return (
    <HomeStageClient
      allPhotos={allPhotos}
      collections={collections}
      collectionsMap={collectionsMap}
      settings={settings}
    />
  );
}
