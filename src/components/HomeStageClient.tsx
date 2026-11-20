"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Images, Layers, MapPin } from "lucide-react";
import type { Photo } from "@/lib/db/schema";
import type { CollectionWithPhotos } from "@/lib/queries";
import { resolveHomepageSections } from "@/lib/homepage-config";
import {
  buildGroupMap,
  formatNumberedTitle,
  type DisplayPhotoCard,
} from "@/lib/photo-groups";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { Lightbox } from "./Lightbox";
import { Reveal } from "./Reveal";
import { GalleryImage } from "./GalleryImage";
import { ViewLink } from "./ViewLink";
import { optImg, optSrcSet } from "@/lib/image-url";
import { usePreferences } from "./PreferencesProvider";

interface HomeStageClientProps {
  allPhotos: Photo[];
  collections: CollectionWithPhotos[];
  collectionsMap: Record<number, { slug: string; title: string; titleEn: string }[]>;
  settings: Record<string, string>;
}

const HOME_ROW_TARGET = 4.3;

function buildHomePreviewRows(cards: DisplayPhotoCard[]): DisplayPhotoCard[][] {
  const rows: DisplayPhotoCard[][] = [];
  let curr: DisplayPhotoCard[] = [];
  let sum = 0;
  for (const card of cards) {
    const p = card.photo;
    const ratio = Math.max(0.55, Math.min(2.4, (p.width || 1600) / (p.height || 1068)));
    curr.push(card);
    sum += ratio;
    if (sum >= HOME_ROW_TARGET || curr.length >= 4) {
      rows.push(curr);
      curr = [];
      sum = 0;
    }
  }
  if (curr.length > 0) rows.push(curr);
  return rows;
}

export function HomeStageClient({
  allPhotos,
  collections,
  collectionsMap,
  settings,
}: HomeStageClientProps) {
  const { locale, pick } = usePreferences();

  const {
    heroSlides: slides,
    curatedCollections,
    galleryCards,
    galleryLightboxPhotos,
  } = useMemo(
    () => resolveHomepageSections(allPhotos, collections, settings),
    [allPhotos, collections, settings]
  );

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [lightboxList, setLightboxList] = useState<Photo[]>(slides);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const heroParallaxRef = useRef<HTMLDivElement>(null);
  const heroTouchRef = useRef<{ x: number; y: number } | null>(null);

  const activeSlide = slides[index] ?? slides[0];

  useEffect(() => {
    if (index >= slides.length && slides.length > 0) {
      setIndex(0);
    }
  }, [index, slides.length]);

  // GPU-composited scroll parallax on Hero Carousel (zero React state churn)
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        const el = heroParallaxRef.current;
        if (!el || y > window.innerHeight * 1.1) return;
        el.style.transform = `translate3d(0, ${(y * 0.24).toFixed(1)}px, 0)`;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

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

  const previewRows = useMemo(() => buildHomePreviewRows(galleryCards), [galleryCards]);
  const slideGroupMap = useMemo(() => buildGroupMap(slides), [slides]);

  const openFromList = (target: Photo, list: Photo[], explicitIdx?: number) => {
    setLightboxList(list);
    setLightboxIdx(
      explicitIdx !== undefined
        ? explicitIdx
        : Math.max(0, list.findIndex((p) => p.id === target.id))
    );
  };

  if (!activeSlide) {
    return (
      <div className="min-h-dvh flex flex-col">
        <SiteHeader
          photographerName={settings.photographerName}
          photographerNameEn={settings.photographerNameEn}
        />
        <div className="flex flex-1 items-center justify-center text-sm text-[var(--fg-muted)]">
          暂无作品，前往 <ViewLink href="/admin" className="underline ml-1">/admin</ViewLink> 上传。
        </div>
      </div>
    );
  }

  const activeSlideGroup = slideGroupMap.get(activeSlide.id);
  const title = pick(
    formatNumberedTitle(activeSlide.title, activeSlideGroup),
    formatNumberedTitle(activeSlide.titleEn, activeSlideGroup)
  );
  const place = pick(activeSlide.location, activeSlide.locationEn);

  return (
    <div className="min-h-dvh">
      <SiteHeader
        overlay
        photographerName={settings.photographerName}
        photographerNameEn={settings.photographerNameEn}
      />

      {/* SECTION 1: Full-Bleed Hero Carousel with Parallax, Touch Swipe & Ken Burns */}
      <section
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={(e) => {
          const t = e.touches[0];
          if (t) heroTouchRef.current = { x: t.clientX, y: t.clientY };
        }}
        onTouchEnd={(e) => {
          const start = heroTouchRef.current;
          heroTouchRef.current = null;
          const t = e.changedTouches[0];
          if (!start || !t || slides.length <= 1) return;
          const dx = t.clientX - start.x;
          const dy = t.clientY - start.y;
          if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.2) {
            setIndex((i) => (dx < 0 ? (i + 1) % slides.length : (i - 1 + slides.length) % slides.length));
          }
        }}
        className="group relative h-[76dvh] sm:h-[86dvh] w-full overflow-hidden bg-black select-none"
      >
        <div ref={heroParallaxRef} className="absolute inset-0">
          {slides.map((s, i) => {
            const isCurrent = i === index;
            const isAdjacent =
              slides.length > 1 &&
              (i === (index + 1) % slides.length || i === (index - 1 + slides.length) % slides.length);
            if (!isCurrent && !isAdjacent) return null;
            return (
              <div
                key={s.id}
                className={`absolute inset-0 transition-opacity duration-1000 ease-out ${
                  isCurrent ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
                }`}
              >
                <img
                  key={isCurrent ? `active-${s.id}` : `idle-${s.id}`}
                  data-morph-photo-id={isCurrent ? s.id : undefined}
                  src={optImg(s.url, 1920, 85)}
                  srcSet={optSrcSet(s.url, [828, 1200, 1920, 2048], 85)}
                  sizes="100vw"
                  fetchPriority={isCurrent ? "high" : "low"}
                  decoding="async"
                  alt={pick(s.title, s.titleEn)}
                  onClick={() => openFromList(activeSlide, slides)}
                  className={`h-full w-full object-cover cursor-zoom-in ${
                    isCurrent ? "animate-hero-breath" : ""
                  }`}
                />
              </div>
            );
          })}
        </div>

        {slides.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => setIndex((i) => (i - 1 + slides.length) % slides.length)}
              aria-label="上一张"
              className="absolute left-4 top-1/2 z-20 -translate-y-1/2 p-2.5 text-white/60 opacity-0 group-hover:opacity-100 hover:text-white transition cursor-pointer"
            >
              <ChevronLeft className="h-7 w-7 stroke-[1.5]" />
            </button>
            <button
              type="button"
              onClick={() => setIndex((i) => (i + 1) % slides.length)}
              aria-label="下一张"
              className="absolute right-4 top-1/2 z-20 -translate-y-1/2 p-2.5 text-white/60 opacity-0 group-hover:opacity-100 hover:text-white transition cursor-pointer"
            >
              <ChevronRight className="h-7 w-7 stroke-[1.5]" />
            </button>
          </>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/82 via-black/28 to-transparent pt-20 pb-5 sm:pt-24 sm:pb-7">
          <div className="pointer-events-auto mx-auto flex max-w-[1440px] items-end justify-between gap-4 px-4 sm:px-9 text-white">
            <div key={activeSlide.id} className="min-w-0 space-y-1 sm:space-y-1.5 animate-photo-switch">
              <h1 className="truncate text-xl sm:text-[28px] font-semibold tracking-tight">{title}</h1>
              {place && (
                <p className="inline-flex items-center gap-1 text-xs sm:text-sm text-white/80">
                  <MapPin className="h-3.5 w-3.5 shrink-0 opacity-85" />
                  <span className="truncate">{place}</span>
                </p>
              )}
            </div>

            <div className="flex shrink-0 flex-col items-end sm:flex-row sm:items-center gap-2.5 sm:gap-5">
              {slides.length > 1 && (
                <div className="flex items-center gap-1.5 sm:gap-2">
                  {slides.map((s, i) => (
                    <button
                      key={s.id}
                      type="button"
                      aria-label={`切换到第 ${i + 1} 张`}
                      onClick={() => setIndex(i)}
                      className={`h-[2.5px] transition-all duration-300 cursor-pointer ${
                        i === index ? "w-6 sm:w-8 bg-white" : "w-2.5 sm:w-3.5 bg-white/35 hover:bg-white/70"
                      }`}
                    />
                  ))}
                </div>
              )}

              <ViewLink
                href="/gallery"
                className="inline-flex items-center gap-1.5 sm:gap-2 rounded-md border border-white/25 bg-white/12 px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-white backdrop-blur-md hover:bg-white/22 hover:border-white/40 transition"
              >
                <span>{locale === "en" ? "Enter Gallery" : "进入相册"}</span>
                <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </ViewLink>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: Curated Series Covers */}
      {curatedCollections.length > 0 && (
        <section className="relative z-10 bg-[var(--bg)] mx-auto max-w-[1440px] px-4 pt-10 sm:px-9 sm:pt-14 space-y-4 sm:space-y-5">
          <Reveal>
            <div className="flex items-center justify-between">
              <h2 className="inline-flex items-center gap-2 text-xl sm:text-2xl font-semibold text-[var(--fg)]">
                <Layers className="h-5 w-5 opacity-75" />
                <span>{locale === "en" ? "Series" : "影集"}</span>
              </h2>
              <ViewLink
                href="/collections"
                className="inline-flex items-center gap-1.5 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] transition"
              >
                <span>{locale === "en" ? "All" : "全部"}</span>
                <ArrowRight className="h-4 w-4" />
              </ViewLink>
            </div>
          </Reveal>

          <div
            className={`grid grid-cols-1 gap-6 ${
              curatedCollections.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2"
            }`}
          >
            {curatedCollections.map((col, idx) => {
              const cTitle = pick(col.title, col.titleEn);
              return (
                <Reveal key={col.id} delayMs={idx * 80}>
                  <ViewLink
                    href={`/collections/${col.slug}`}
                    className="group relative isolate block space-y-2 hover:z-20"
                  >
                    <div className="relative aspect-[16/10]">
                      <div className="photo-frame relative h-full w-full overflow-hidden bg-[var(--bg-elevated)]">
                        {col.coverUrl && (
                          <img
                            src={optImg(col.coverUrl, 828, 85)}
                            srcSet={optSrcSet(col.coverUrl, [640, 828, 1200], 85)}
                            sizes="(max-width: 768px) 96vw, 33vw"
                            loading="lazy"
                            decoding="async"
                            alt={cTitle}
                            className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.035]"
                          />
                        )}
                        <div className="glass-strip absolute inset-x-0 bottom-0 flex items-center justify-between px-4 py-3 text-white">
                          <h3 className="text-base sm:text-lg font-semibold truncate">{cTitle}</h3>
                          <span className="text-xs text-zinc-200 shrink-0 ml-2">
                            {[col.period, `${col.photoCount}`].filter(Boolean).join(" · ")}
                          </span>
                        </div>
                      </div>
                    </div>

                    {col.photos.length > 1 && (
                      <div className="grid grid-cols-4 gap-1.5">
                        {col.photos.slice(0, 4).map((p) => (
                          <div
                            key={p.id}
                            className="photo-frame aspect-[3/2] overflow-hidden bg-[var(--bg-elevated)] opacity-80 group-hover:opacity-100 transition"
                          >
                            <img
                              src={optImg(p.url, 256, 75)}
                              loading="lazy"
                              decoding="async"
                              alt={p.title}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </ViewLink>
                </Reveal>
              );
            })}
          </div>
        </section>
      )}

      {/* SECTION 3: Curated Homepage Album Mosaic */}
      {previewRows.length > 0 && (
        <section className="mx-auto max-w-[1440px] px-4 pt-12 sm:px-9 sm:pt-16 space-y-4 sm:space-y-5">
          <Reveal>
            <div className="flex items-center justify-between">
              <h2 className="inline-flex items-center gap-2 text-xl sm:text-2xl font-semibold text-[var(--fg)]">
                <Images className="h-5 w-5 opacity-75" />
                <span>{locale === "en" ? "Gallery" : "相册"}</span>
              </h2>
              <ViewLink
                href="/gallery"
                className="inline-flex items-center gap-1.5 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] transition"
              >
                <span>
                  {locale === "en" ? `All ${allPhotos.length}` : `全部 ${allPhotos.length}`}
                </span>
                <ArrowRight className="h-4 w-4" />
              </ViewLink>
            </div>
          </Reveal>

          <div className="space-y-2">
            {previewRows.map((row, rIdx) => (
              <Reveal key={rIdx} delayMs={rIdx * 80}>
                <div className="flex flex-col sm:flex-row gap-2">
                  {row.map((card) => {
                    const { photo: item, flatIdx, isStackedCover, groupTotal, groupIndex } = card;
                    const ratio = Math.max(0.5, Math.min(2.5, (item.width || 1600) / (item.height || 1068)));
                    const iTitle =
                      isStackedCover || groupTotal <= 1
                        ? pick(item.title, item.titleEn)
                        : pick(
                            formatNumberedTitle(item.title, { index: groupIndex, total: groupTotal }),
                            formatNumberedTitle(item.titleEn, { index: groupIndex, total: groupTotal })
                          );
                    const iPlace = pick(item.location, item.locationEn);
                    return (
                      <figure
                        key={item.id}
                        onClick={() => openFromList(item, galleryLightboxPhotos, flatIdx)}
                        style={{ "--item-grow": ratio } as React.CSSProperties}
                        className="group relative cursor-pointer hover:z-20 sm:[flex-basis:0%] sm:[flex-grow:var(--item-grow)]"
                      >
                        <GalleryImage
                          photoId={item.id}
                          src={item.url}
                          alt={iTitle}
                          ambient={item.ambient}
                          blurData={item.blurData}
                          aspectRatio={`${item.width || 1600} / ${item.height || 1068}`}
                          className="w-full h-full"
                        />
                        {groupTotal > 1 && (
                          <span className="pointer-events-none absolute right-2.5 top-2.5 z-10 inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-md">
                            <Layers className="h-3 w-3" />
                            <span>{isStackedCover ? groupTotal : `${groupIndex}/${groupTotal}`}</span>
                          </span>
                        )}
                        <figcaption className="glass-strip pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between px-3.5 py-2.5 text-sm text-zinc-100 opacity-0 translate-y-1 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0">
                          <span className="truncate font-medium">{iTitle}</span>
                          {iPlace && (
                            <span className="inline-flex items-center gap-1 text-xs text-zinc-200 shrink-0 ml-2">
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
      )}

      <SiteFooter settings={settings} />

      <Lightbox
        photos={lightboxList}
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
