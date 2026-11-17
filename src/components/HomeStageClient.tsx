"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Images, Layers, Mail, MapPin, User } from "lucide-react";
import type { Photo } from "@/lib/db/schema";
import type { CollectionWithPhotos } from "@/lib/queries";
import { SiteHeader } from "./SiteHeader";
import { Lightbox } from "./Lightbox";
import { Reveal } from "./Reveal";
import { usePreferences } from "./PreferencesProvider";

interface HomeStageClientProps {
  featuredPhotos: Photo[];
  allPhotos: Photo[];
  collections: CollectionWithPhotos[];
  collectionsMap: Record<number, { slug: string; title: string; titleEn: string }[]>;
  settings: Record<string, string>;
}

export function HomeStageClient({
  featuredPhotos,
  allPhotos,
  collections,
  collectionsMap,
  settings,
}: HomeStageClientProps) {
  const { locale, pick } = usePreferences();

  const slides = useMemo(() => {
    const wide = featuredPhotos.filter((p) => (p.width || 1600) >= (p.height || 1068));
    return wide.length >= 2 ? wide : featuredPhotos;
  }, [featuredPhotos]);

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [lightboxList, setLightboxList] = useState<Photo[]>(featuredPhotos);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const activeSlide = slides[index] ?? slides[0];

  useEffect(() => {
    if (paused || lightboxIdx !== null || slides.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, 5200);
    return () => clearInterval(timer);
  }, [lightboxIdx, paused, slides.length]);

  useEffect(() => {
    if (lightboxIdx !== null || slides.length <= 1) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + slides.length) % slides.length);
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % slides.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIdx, slides.length]);

  // Keep Homepage Album preview to 2 clean rows (8 photos)
  const previewRows = useMemo(() => {
    const slice = allPhotos.slice(0, 8);
    return [slice.slice(0, 4), slice.slice(4, 8)].filter((r) => r.length > 0);
  }, [allPhotos]);

  const openFromList = (target: Photo, list: Photo[]) => {
    setLightboxList(list);
    setLightboxIdx(Math.max(0, list.findIndex((p) => p.id === target.id)));
  };

  if (!activeSlide) {
    return (
      <div className="min-h-dvh flex flex-col">
        <SiteHeader
          photographerName={settings.photographerName}
          photographerNameEn={settings.photographerNameEn}
        />
        <div className="flex flex-1 items-center justify-center text-sm text-[var(--fg-muted)]">
          暂无作品，前往 <Link href="/admin" className="underline ml-1">/admin</Link> 上传。
        </div>
      </div>
    );
  }

  const title = pick(activeSlide.title, activeSlide.titleEn);
  const place = pick(activeSlide.location, activeSlide.locationEn);

  return (
    <div className="min-h-dvh">
      {/* SECTION 1: Full-Bleed Hero Carousel with subtle Ken Burns settle */}
      <section
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        className="group relative h-[86dvh] w-full overflow-hidden bg-black select-none"
      >
        <SiteHeader
          overlay
          photographerName={settings.photographerName}
          photographerNameEn={settings.photographerNameEn}
        />

        {slides.map((s, i) => {
          const isCurrent = i === index;
          return (
            <div
              key={s.id}
              className={`absolute inset-0 transition-opacity duration-1000 ease-out ${
                isCurrent ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
              }`}
            >
              <img
                key={isCurrent ? `active-${s.id}` : `idle-${s.id}`}
                src={s.url}
                alt={pick(s.title, s.titleEn)}
                onClick={() => openFromList(activeSlide, slides)}
                className={`h-full w-full object-cover cursor-zoom-in ${
                  isCurrent ? "animate-hero-breath" : ""
                }`}
              />
            </div>
          );
        })}

        {slides.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => setIndex((i) => (i - 1 + slides.length) % slides.length)}
              aria-label="上一张"
              className="absolute left-4 top-1/2 z-20 -translate-y-1/2 p-2.5 text-white/60 opacity-0 group-hover:opacity-100 hover:text-white transition"
            >
              <ChevronLeft className="h-7 w-7 stroke-[1.5]" />
            </button>
            <button
              type="button"
              onClick={() => setIndex((i) => (i + 1) % slides.length)}
              aria-label="下一张"
              className="absolute right-4 top-1/2 z-20 -translate-y-1/2 p-2.5 text-white/60 opacity-0 group-hover:opacity-100 hover:text-white transition"
            >
              <ChevronRight className="h-7 w-7 stroke-[1.5]" />
            </button>
          </>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 via-black/25 to-transparent pt-24 pb-7">
          <div className="pointer-events-auto mx-auto flex max-w-[1440px] items-end justify-between gap-6 px-6 sm:px-9 text-white">
            <div key={activeSlide.id} className="space-y-1 animate-photo-switch">
              <h1 className="text-2xl sm:text-[28px] font-semibold tracking-wide">{title}</h1>
              {place && (
                <p className="inline-flex items-center gap-1.5 text-sm text-white/80">
                  <MapPin className="h-3.5 w-3.5 opacity-85" />
                  <span>{place}</span>
                </p>
              )}
            </div>

            {slides.length > 1 && (
              <div className="flex items-center gap-2 pb-1.5">
                {slides.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-label={`切换到第 ${i + 1} 张`}
                    onClick={() => setIndex(i)}
                    className={`h-[2.5px] transition-all duration-300 ${
                      i === index ? "w-8 bg-white" : "w-3.5 bg-white/35 hover:bg-white/70"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* SECTION 2: Curated Series Covers */}
      {collections.length > 0 && (
        <section className="mx-auto max-w-[1440px] px-6 pt-12 sm:px-9 space-y-5">
          <Reveal>
            <div className="flex items-center justify-between">
              <h2 className="inline-flex items-center gap-2 text-xl sm:text-2xl font-semibold text-[var(--fg)]">
                <Layers className="h-5 w-5 opacity-75" />
                <span>{locale === "en" ? "Series" : "影集"}</span>
              </h2>
              <Link
                href="/collections"
                className="inline-flex items-center gap-1.5 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] transition"
              >
                <span>{locale === "en" ? "All" : "全部"}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>

          <div
            className={`grid grid-cols-1 gap-6 ${
              collections.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2"
            }`}
          >
            {collections.map((col, idx) => {
              const cTitle = pick(col.title, col.titleEn);
              return (
                <Reveal key={col.id} delayMs={idx * 80}>
                  <Link
                    href={`/collections/${col.slug}`}
                    className="group block space-y-2"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden bg-[var(--bg-elevated)]">
                      {col.coverUrl && (
                        <img
                          src={col.coverUrl}
                          alt={cTitle}
                          className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.03]"
                        />
                      )}
                      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/85 via-black/30 to-transparent p-5 text-white">
                        <h3 className="text-lg sm:text-xl font-semibold">{cTitle}</h3>
                        <span className="text-xs sm:text-sm text-zinc-200">
                          {[col.period, `${col.photoCount}`].filter(Boolean).join(" · ")}
                        </span>
                      </div>
                    </div>

                    {col.photos.length > 1 && (
                      <div className="grid grid-cols-4 gap-1.5">
                        {col.photos.slice(0, 4).map((p) => (
                          <div
                            key={p.id}
                            className="aspect-[3/2] overflow-hidden bg-[var(--bg-elevated)] opacity-80 group-hover:opacity-100 transition"
                          >
                            <img src={p.url} alt={p.title} className="h-full w-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </section>
      )}

      {/* SECTION 3: Album Mosaic (2 Rows) */}
      <section className="mx-auto max-w-[1440px] px-6 pt-16 sm:px-9 space-y-5">
        <Reveal>
          <div className="flex items-center justify-between">
            <h2 className="inline-flex items-center gap-2 text-xl sm:text-2xl font-semibold text-[var(--fg)]">
              <Images className="h-5 w-5 opacity-75" />
              <span>{locale === "en" ? "Gallery" : "相册"}</span>
            </h2>
            <Link
              href="/gallery"
              className="inline-flex items-center gap-1.5 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] transition"
            >
              <span>
                {locale === "en" ? `All ${allPhotos.length}` : `全部 ${allPhotos.length}`}
              </span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Reveal>

        <div className="space-y-2">
          {previewRows.map((row, rIdx) => (
            <Reveal key={rIdx} delayMs={rIdx * 80}>
              <div className="flex flex-col sm:flex-row gap-2">
                {row.map((item) => {
                  const ratio = Math.max(0.5, Math.min(2.5, (item.width || 1600) / (item.height || 1068)));
                  const iTitle = pick(item.title, item.titleEn);
                  const iPlace = pick(item.location, item.locationEn);
                  return (
                    <figure
                      key={item.id}
                      onClick={() => openFromList(item, allPhotos)}
                      style={{ flexGrow: ratio, flexBasis: "0%" }}
                      className="group relative cursor-pointer overflow-hidden bg-[var(--bg-elevated)]"
                    >
                      <img
                        src={item.url}
                        alt={iTitle}
                        style={{ aspectRatio: `${item.width || 1600} / ${item.height || 1068}` }}
                        className="w-full h-full block object-cover transition duration-600 ease-out group-hover:scale-[1.03]"
                      />
                      <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/85 via-black/30 to-transparent px-4 py-3 text-sm text-zinc-100 opacity-0 translate-y-1 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0">
                        <span className="truncate font-medium">{iTitle}</span>
                        {iPlace && (
                          <span className="inline-flex items-center gap-1 text-xs text-zinc-300 shrink-0 ml-2">
                            <MapPin className="h-3 w-3" />
                            {iPlace.split(",")[0]}
                          </span>
                        )}
                      </figcaption>
                    </figure>
                  );
                })}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="mx-auto max-w-[1440px] px-6 pt-16 pb-12 sm:px-9">
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--border)] pt-6 text-sm text-[var(--fg-muted)]">
          <div className="flex items-center gap-3">
            <span className="text-[var(--fg)] font-medium">
              © {new Date().getFullYear()} {pick(settings.photographerName || "林远", settings.photographerNameEn)}
            </span>
            {settings.baseLocation && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 opacity-70" />
                {pick(settings.baseLocation, settings.baseLocationEn)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-6">
            <Link href="/about" className="inline-flex items-center gap-1.5 hover:text-[var(--fg)] transition">
              <User className="h-3.5 w-3.5" />
              <span>{locale === "en" ? "About" : "关于"}</span>
            </Link>
            {settings.email && (
              <a
                href={`mailto:${settings.email}`}
                className="inline-flex items-center gap-1.5 hover:text-[var(--fg)] transition"
              >
                <Mail className="h-3.5 w-3.5" />
                <span>{settings.email}</span>
              </a>
            )}
          </div>
        </div>
      </footer>

      <Lightbox
        photos={lightboxList}
        activeIndex={lightboxIdx}
        collectionsMap={collectionsMap}
        onClose={() => setLightboxIdx(null)}
        onChangeIndex={setLightboxIdx}
      />
    </div>
  );
}
