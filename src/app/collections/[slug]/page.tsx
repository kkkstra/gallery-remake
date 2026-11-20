import { notFound } from "next/navigation";
import { getCollectionsWithPhotos, getPhotoCollectionsMap, getSiteSettings } from "@/lib/queries";
import { CollectionDetailClient } from "@/components/CollectionDetailClient";

export const revalidate = 300;

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [allCollections, collectionsMap, settings] = await Promise.all([
    getCollectionsWithPhotos(),
    getPhotoCollectionsMap(),
    getSiteSettings(),
  ]);

  const idx = allCollections.findIndex((c) => c.slug === slug);
  if (idx === -1) notFound();

  const collection = allCollections[idx];
  const nextCollection =
    allCollections.length > 1 ? allCollections[(idx + 1) % allCollections.length] : null;

  return (
    <CollectionDetailClient
      collection={collection}
      nextCollection={nextCollection}
      collectionsMap={collectionsMap}
      settings={settings}
    />
  );
}
