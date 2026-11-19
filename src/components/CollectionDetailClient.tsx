"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Aperture, ArrowLeft, Calendar, Camera, Images, Maximize2, MapPin } from "lucide-react";
import type { CollectionWithPhotos } from "@/lib/queries";
import type { Photo } from "@/lib/db/schema";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { Lightbox } from "./Lightbox";
import { Reveal } from "./Reveal";
import { ViewLink } from "./ViewLink";
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
  const spreadsContainerRef = useRef<HTMLDivElement>(null);

  const photos = collection.photos;
  const title = pick(collection.title, collection.titleEn);
  const desc = pick(collection.description, collection.descriptionEn);

  // Subtle GPU-composited scroll parallax on offset paired plates
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const updateParallax = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const items = spreadsContainerRef.current?.querySelectorAll<HTMLElement>("[data-parallax-speed]");
        if (!items) return;
        const vh = window.innerHeight;
        items.forEach((el) => {
          const rect = el.getBoundingClientRect();
          if (rect.bottom < -200 || rect.top > vh + 200) return;
          const speed = Number(el.dataset.parallaxSpeed || 0);
          const progress = (rect.top + rect.height / 2 - vh / 2) / vh;
          el.style.transform = `translate3d(0, ${(progress * speed).toFixed(1)}px, 0)`;
        });
      });
    };
    updateParallax();
    window.addEventListener("scroll", updateParallax, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", updateParallax);
    };
  }, [photos.length]);

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
    <div className="min-h-dvh flex flex-col">
      <SiteHeader
        photographerName={settings.photographerName}
        photographerNameEn={settings.photographerNameEn}
      />

      <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 pt-6 sm:px-9 sm:pt-10">
        <header className="max-w-2xl space-y-3 sm:space-y-4 border-b border-[var(--border)] pb-8 sm:pb-12">
          <ViewLink
            href="/collections"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{locale === "en" ? "Series" : "返回影集"}</span>
          </ViewLink>

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

        {/* Relaxed Monograph Spreads with Subtle Parallax Depth & Shared-Element Morph */}
        <div ref={spreadsContainerRef} className="pt-10 sm:pt-16 space-y-14 sm:space-y-32">
          {spreads.map((row, rIdx) => {
            if (row.kind === "single") {
              const photo = row.items[0].photo;
              const isPortrait = (photo.height || 1068) > (photo.width || 1600);
              const isLeadCover = rIdx === 0 && photo.url === collection.coverUrl;
              return (
                <Reveal key={photo.id}>
                  <figure
                    onClick={() => setLightboxIdx(row.items[0].idx)}
                    className={`group cursor-pointer ${
                      isPortrait
                        ? "mx-auto max-w-[420px]"
                        : rIdx % 4 === 0
                        ? "max-w-[820px] md:ml-auto"
                        : "max-w-[820px]"
                    }`}
                  >
                    <div className="relative isolate">
                      <img
                        src={photo.url}
                        alt=""
                        aria-hidden="true"
                        decoding="async"
                        className="ambient-photo-halo pointer-events-none absolute -inset-2 -z-10 h-[calc(100%+16px)] w-[calc(100%+16px)] max-w-none rounded-xl object-cover"
                      />
                      <div className="photo-frame relative overflow-hidden">
                        <img
                          data-morph-photo-id={photo.id}
                          src={photo.url}
                          alt={photo.title}
                          style={
                            isLeadCover ? { viewTransitionName: `series-cover-${collection.slug}` } : undefined
                          }
                          className="w-full h-auto block transition duration-600 ease-out group-hover:scale-[1.015]"
                        />
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white/90 opacity-0 scale-90 backdrop-blur-md transition-all duration-250 group-hover:opacity-100 group-hover:scale-100"
                        >
                          <Maximize2 className="h-3.5 w-3.5 stroke-[1.6]" />
                        </span>
                      </div>
                    </div>
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
                    data-parallax-speed="-12"
                    onClick={() => setLightboxIdx(row.items[0].idx)}
                    className={`group cursor-pointer will-change-transform ${
                      leftPortrait ? "md:col-span-4 md:col-start-2" : "md:col-span-5"
                    }`}
                  >
                    <div className="relative isolate">
                      <img
                        src={row.items[0].photo.url}
                        alt=""
                        aria-hidden="true"
                        decoding="async"
                        className="ambient-photo-halo pointer-events-none absolute -inset-2 -z-10 h-[calc(100%+16px)] w-[calc(100%+16px)] max-w-none rounded-xl object-cover"
                      />
                      <div className="photo-frame relative overflow-hidden">
                        <img
                          data-morph-photo-id={row.items[0].photo.id}
                          src={row.items[0].photo.url}
                          alt={row.items[0].photo.title}
                          className="w-full h-auto block transition duration-600 ease-out group-hover:scale-[1.02]"
                        />
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white/90 opacity-0 scale-90 backdrop-blur-md transition-all duration-250 group-hover:opacity-100 group-hover:scale-100"
                        >
                          <Maximize2 className="h-3.5 w-3.5 stroke-[1.6]" />
                        </span>
                      </div>
                    </div>
                    <PlateCaption photo={row.items[0].photo} />
                  </figure>

                  <figure
                    data-parallax-speed="16"
                    onClick={() => setLightboxIdx(row.items[1].idx)}
                    className={`group cursor-pointer md:mt-20 will-change-transform ${
                      rightPortrait ? "md:col-span-4 md:col-start-8" : "md:col-span-6 md:col-start-7"
                    }`}
                  >
                    <div className="relative isolate">
                      <img
                        src={row.items[1].photo.url}
                        alt=""
                        aria-hidden="true"
                        decoding="async"
                        className="ambient-photo-halo pointer-events-none absolute -inset-2 -z-10 h-[calc(100%+16px)] w-[calc(100%+16px)] max-w-none rounded-xl object-cover"
                      />
                      <div className="photo-frame relative overflow-hidden">
                        <img
                          data-morph-photo-id={row.items[1].photo.id}
                          src={row.items[1].photo.url}
                          alt={row.items[1].photo.title}
                          className="w-full h-auto block transition duration-600 ease-out group-hover:scale-[1.02]"
                        />
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white/90 opacity-0 scale-90 backdrop-blur-md transition-all duration-250 group-hover:opacity-100 group-hover:scale-100"
                        >
                          <Maximize2 className="h-3.5 w-3.5 stroke-[1.6]" />
                        </span>
                      </div>
                    </div>
                    <PlateCaption photo={row.items[1].photo} />
                  </figure>
                </div>
              </Reveal>
            );
          })}
        </div>
      </main>

      <SiteFooter settings={settings} />

      <Lightbox
        photos={photos}
        activeIndex={lightboxIdx}
        collectionsMap={collectionsMap}
        photographerName={settings.photographerName}
        photographerNameEn={settings.photographerNameEn}
        onClose={() => setLightboxIdx(null)}
        onChangeIndex={setLightboxIdx}
      />
    </div>
  );
}
