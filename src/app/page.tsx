import {
  getAllPhotos,
  getCollectionsWithPhotos,
  getFeaturedPhotos,
  getPhotoCollectionsMap,
  getSiteSettings,
} from "@/lib/queries";
import { HomeStageClient } from "@/components/HomeStageClient";

export const revalidate = 300;

export default async function HomePage() {
  const [featuredPhotos, allPhotos, collections, collectionsMap, settings] = await Promise.all([
    getFeaturedPhotos(),
    getAllPhotos(),
    getCollectionsWithPhotos(),
    getPhotoCollectionsMap(),
    getSiteSettings(),
  ]);

  return (
    <HomeStageClient
      featuredPhotos={featuredPhotos}
      allPhotos={allPhotos}
      collections={collections}
      collectionsMap={collectionsMap}
      settings={settings}
    />
  );
}
