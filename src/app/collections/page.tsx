import { getCollectionsWithPhotos, getSiteSettings } from "@/lib/queries";
import { CollectionsClient } from "@/components/CollectionsClient";

export const revalidate = 300;

export default async function CollectionsPage() {
  const [collections, settings] = await Promise.all([
    getCollectionsWithPhotos(),
    getSiteSettings(),
  ]);

  return <CollectionsClient collections={collections} settings={settings} />;
}
