"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Aperture, ArrowLeft, Calendar, Camera, Images, MapPin } from "lucide-react";
import type { CollectionWithPhotos } from "@/lib/queries";
import type { Photo } from "@/lib/db/schema";
import { SiteHeader } from "./SiteHeader";
import { Lightbox } from "./Lightbox";
import { Reveal } from "./Reveal";
import { usePreferences } from "./PreferencesProvider";

interface CollectionDetailClientProps {
  collection: CollectionWithPhotos;
  collectionsMap: Record<number, { slug: string; title: string; titleEn: string }[]>;
  settings: Record<string, string>;
}

export function CollectionDetailClient({
  collection,
  collectionsMap,
  settings,
}: CollectionDetailClientProps) {
  const { locale, pick } = usePreferences();
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const photos = collection.photos;
  const title = pick(collection.title, collection.titleEn);
  const desc = pick(collection.description, collection.descriptionEn);

  // Airy Monograph rhythm: alternate relaxed single plate and staggered pair
  const spreads = useMemo(() => {
    const out: { kind: "single" | "pair"; items: { photo: Photo; idx: number }[] }[] = [];
    let i = 0;
    while (i < photos.length) {
      if (out.length % 2 === 0 || i === photos.length - 1) {
        out.push({ kind: "single", items: [{ photo: photos[i], idx: i }] });
        i += 1;
      } else {
        out.push({
          kind: "pair",
          items: [
            { photo: photos[i], idx: i },
            { photo: photos[i + 1], idx: i + 1 },
          ],
        });
        i += 2;
      }
    }
    return out;
  }, [photos]);

  const PlateCaption = ({ photo }: { photo: Photo }) => {
    const pTitle = pick(photo.title, photo.titleEn);
    const pPlace = pick(photo.location, photo.locationEn);
    return (
      <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-medium text-[var(--fg)]">{pTitle}</span>
          {pPlace && (
            <span className="inline-flex items-center gap-1 text-xs sm:text-sm text-[var(--fg-muted)]">
              <MapPin className="h-3.5 w-3.5 opacity-70" />
              {pPlace}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-[var(--fg-muted)]">
          {photo.camera && (
            <span className="inline-flex items-center gap-1">
              <Camera className="h-3.5 w-3.5 opacity-70" />
              {photo.camera}
            </span>
          )}
          {(photo.focalMm || photo.aperture) && (
            <span className="inline-flex items-center gap-1">
              <Aperture className="h-3.5 w-3.5 opacity-70" />
              {[photo.focalMm ? `${photo.focalMm}mm` : "", photo.aperture, photo.shutter]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )}
        </div>
      </figcaption>
    );
  };

  return (
    <div className="min-h-dvh pb-28">
      <SiteHeader
        photographerName={settings.photographerName}
        photographerNameEn={settings.photographerNameEn}
      />

      <main className="mx-auto max-w-[1320px] px-6 pt-10 sm:px-9">
        <header className="max-w-2xl space-y-4 border-b border-[var(--border)] pb-12">
          <Link
            href="/collections"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{locale === "en" ? "Series" : "返回影集"}</span>
          </Link>

          <div className="space-y-2">
            <div className="flex items-center gap-4 text-sm text-[var(--fg-muted)]">
              {collection.period && (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 opacity-75" />
                  {collection.period}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Images className="h-4 w-4 opacity-75" />
                {photos.length} {locale === "en" ? "Photos" : "幅"}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-semibold text-[var(--fg)]">{title}</h1>
          </div>

          {desc && <p className="text-[15px] leading-7 text-[var(--fg-muted)]">{desc}</p>}
        </header>

        {/* Relaxed, Airy Monograph Spreads — Constrained scale (~60vh), transparent ground (zero white borders) */}
        <div className="pt-16 space-y-24 sm:space-y-32">
          {spreads.map((row, rIdx) => {
            if (row.kind === "single") {
              const photo = row.items[0].photo;
              const isPortrait = (photo.height || 1068) > (photo.width || 1600);
              return (
                <Reveal key={photo.id}>
                  <figure
                    onClick={() => setLightboxIdx(row.items[0].idx)}
                    className={`cursor-pointer ${
                      isPortrait
                        ? "mx-auto max-w-[420px]"
                        : rIdx % 4 === 0
                        ? "max-w-[820px] md:ml-auto"
                        : "max-w-[820px]"
                    }`}
                  >
                    <img
                      src={photo.url}
                      alt={photo.title}
                      className="w-full h-auto block transition duration-500 hover:opacity-95"
                    />
                    <PlateCaption photo={photo} />
                  </figure>
                </Reveal>
              );
            }

            const leftPortrait = (row.items[0].photo.height || 1068) > (row.items[0].photo.width || 1600);
            const rightPortrait = (row.items[1].photo.height || 1068) > (row.items[1].photo.width || 1600);

            return (
              <Reveal key={`pair-${rIdx}`}>
                <div className="grid grid-cols-1 gap-12 md:grid-cols-12 items-start">
                  <figure
                    onClick={() => setLightboxIdx(row.items[0].idx)}
                    className={`cursor-pointer ${
                      leftPortrait ? "md:col-span-4 md:col-start-2" : "md:col-span-5"
                    }`}
                  >
                    <img
                      src={row.items[0].photo.url}
                      alt={row.items[0].photo.title}
                      className="w-full h-auto block transition duration-500 hover:opacity-95"
                    />
                    <PlateCaption photo={row.items[0].photo} />
                  </figure>

                  <figure
                    onClick={() => setLightboxIdx(row.items[1].idx)}
                    className={`cursor-pointer md:mt-20 ${
                      rightPortrait ? "md:col-span-4 md:col-start-8" : "md:col-span-6 md:col-start-7"
                    }`}
                  >
                    <img
                      src={row.items[1].photo.url}
                      alt={row.items[1].photo.title}
                      className="w-full h-auto block transition duration-500 hover:opacity-95"
                    />
                    <PlateCaption photo={row.items[1].photo} />
                  </figure>
                </div>
              </Reveal>
            );
          })}
        </div>
      </main>

      <Lightbox
        photos={photos}
        activeIndex={lightboxIdx}
        collectionsMap={collectionsMap}
        onClose={() => setLightboxIdx(null)}
        onChangeIndex={setLightboxIdx}
      />
    </div>
  );
}
