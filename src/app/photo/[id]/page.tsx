import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  buildGroupMap,
  collapsePhotoListForDisplay,
  formatNumberedTitle,
} from "@/lib/photo-groups";
import { getAllPhotos, getPhotoCollectionsMap, getSiteSettings } from "@/lib/queries";
import { PhotoDetailClient } from "@/components/PhotoDetailClient";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const id = Number((await params).id);
  if (!id) return {};
  const [allPhotos, settings] = await Promise.all([getAllPhotos(), getSiteSettings()]);
  const photo = allPhotos.find((p) => p.id === id);
  if (!photo) return {};

  const groupInfo = buildGroupMap(allPhotos).get(photo.id);
  const fullTitle = formatNumberedTitle(photo.title, groupInfo);
  const fullTitleEn = formatNumberedTitle(photo.titleEn, groupInfo);

  const author = settings.photographerName || "林远";
  const specs = [
    photo.camera,
    photo.focalMm ? `${photo.focalMm}mm` : "",
    photo.aperture,
    photo.shutter,
  ]
    .filter(Boolean)
    .join(" · ");
  const desc = [photo.description, photo.location, specs].filter(Boolean).join(" — ");

  return {
    title: `${fullTitle} · ${author}`,
    description: desc,
    openGraph: {
      title: `${fullTitle}${fullTitleEn ? ` / ${fullTitleEn}` : ""}`,
      description: desc,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: `${fullTitle} · ${author}`,
      description: desc,
    },
  };
}

export default async function PhotoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = Number((await params).id);
  if (!id) notFound();

  const [rawPhotos, collectionsMap, settings] = await Promise.all([
    getAllPhotos(),
    getPhotoCollectionsMap(),
    getSiteSettings(),
  ]);

  const { lightboxPhotos: allPhotos } = collapsePhotoListForDisplay(rawPhotos);
  const idx = allPhotos.findIndex((p) => p.id === id);
  if (idx === -1) notFound();

  const photo = allPhotos[idx];
  const prevPhoto = allPhotos.length > 1 ? allPhotos[(idx - 1 + allPhotos.length) % allPhotos.length] : null;
  const nextPhoto = allPhotos.length > 1 ? allPhotos[(idx + 1) % allPhotos.length] : null;

  return (
    <PhotoDetailClient
      photo={photo}
      allPhotos={allPhotos}
      initialIndex={idx}
      prevPhoto={prevPhoto}
      nextPhoto={nextPhoto}
      collections={collectionsMap[photo.id] ?? []}
      collectionsMap={collectionsMap}
      settings={settings}
    />
  );
}
