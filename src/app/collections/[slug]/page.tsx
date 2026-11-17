import { notFound } from "next/navigation";
import { getCollectionBySlug, getPhotoCollectionsMap, getSiteSettings } from "@/lib/queries";
import { CollectionDetailClient } from "@/components/CollectionDetailClient";

export const dynamic = "force-dynamic";

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [collection, collectionsMap, settings] = await Promise.all([
    getCollectionBySlug(slug),
    getPhotoCollectionsMap(),
    getSiteSettings(),
  ]);

  if (!collection) notFound();

  return (
    <CollectionDetailClient
      collection={collection}
      collectionsMap={collectionsMap}
      settings={settings}
    />
  );
}
