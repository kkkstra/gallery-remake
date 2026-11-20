"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Aperture, ArrowLeft, ArrowRight, Camera, Images, MapPin } from "lucide-react";
import type { CollectionWithPhotos } from "@/lib/queries";
import type { Photo } from "@/lib/db/schema";
import { buildGroupMap, formatNumberedTitle } from "@/lib/photo-groups";
import { parseMonographBlocks, type MonographCoverBlock, type MonographPhotoBlock } from "@/lib/monograph";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { Lightbox } from "./Lightbox";
import { Reveal } from "./Reveal";
import { GalleryImage } from "./GalleryImage";
import { ViewLink } from "./ViewLink";
import { optImg, optSrcSet } from "@/lib/image-url";
import { usePreferences } from "./PreferencesProvider";

interface CollectionDetailClientProps {
  collection: CollectionWithPhotos;
  nextCollection?: CollectionWithPhotos | null;
  collectionsMap: Record<number, { slug: string; title: string; titleEn: string }[]>;
  settings: Record<string, string>;
}

type RenderSegment =
  | { type: "cover"; block: MonographCoverBlock; isFirstCover: boolean }
  | { type: "annotated"; block: MonographPhotoBlock; photo: Photo; lightboxIndex: number }
  | { type: "single"; photo: Photo; lightboxIndex: number; alignRight: boolean }
  | { type: "pair"; left: { photo: Photo; lightboxIndex: number }; right: { photo: Photo; lightboxIndex: number } };

export function CollectionDetailClient({
  collection,
  nextCollection,
  collectionsMap,
  settings,
}: CollectionDetailClientProps) {
  const { locale, copyrightGuard, pick } = usePreferences();
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const spreadsContainerRef = useRef<HTMLDivElement>(null);

  const blocks = useMemo(() => parseMonographBlocks(collection.blocksJson, collection), [collection]);

  // Ordered photos matching the monograph sequence for Lightbox navigation
  const orderedPhotos = useMemo(() => {
    const map = new Map(collection.photos.map((p) => [p.id, p]));
    const list: Photo[] = [];
    for (const b of blocks) {
      if (b.kind === "photo") {
        const found = map.get(b.photoId);
        if (found) list.push(found);
      }
    }
    return list.length > 0 ? list : collection.photos;
  }, [blocks, collection.photos]);

  // Build render segments: Cover Pages (can be multiple!) + Annotated Side-Note Plates + Single/Paired Pure Plates
  const segments = useMemo<RenderSegment[]>(() => {
    const map = new Map(collection.photos.map((p) => [p.id, p]));
    const idxMap = new Map(orderedPhotos.map((p, idx) => [p.id, idx]));
    const out: RenderSegment[] = [];
    let pureQueue: { photo: Photo; lightboxIndex: number }[] = [];
    let pureGroupCount = 0;
    let seenFirstCover = false;

    const flushPureQueue = () => {
      let i = 0;
      while (i < pureQueue.length) {
        if (pureGroupCount % 2 === 0 || i === pureQueue.length - 1) {
          out.push({
            type: "single",
            photo: pureQueue[i].photo,
            lightboxIndex: pureQueue[i].lightboxIndex,
            alignRight: pureGroupCount % 4 === 2,
          });
          i += 1;
        } else {
          out.push({
            type: "pair",
            left: pureQueue[i],
            right: pureQueue[i + 1],
          });
          i += 2;
        }
        pureGroupCount += 1;
      }
      pureQueue = [];
    };

    for (const b of blocks) {
      if (b.kind === "cover") {
        flushPureQueue();
        out.push({ type: "cover", block: b, isFirstCover: !seenFirstCover });
        seenFirstCover = true;
      } else {
        const photo = map.get(b.photoId);
        if (!photo) continue;
        const lbIdx = idxMap.get(photo.id) ?? 0;
        const hasNote = Boolean((b.sideNote && b.sideNote.trim()) || (b.sideNoteEn && b.sideNoteEn.trim()));
        if (hasNote) {
          flushPureQueue();
          out.push({ type: "annotated", block: b, photo, lightboxIndex: lbIdx });
        } else {
          pureQueue.push({ photo, lightboxIndex: lbIdx });
        }
      }
    }
    flushPureQueue();
    return out;
  }, [blocks, collection.photos, orderedPhotos]);

  const startsWithFullCover =
    segments[0]?.type === "cover" && segments[0].block.style === "full" && Boolean(segments[0].block.imageUrl);

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
  }, [segments.length]);

  const groupMap = useMemo(() => buildGroupMap(orderedPhotos), [orderedPhotos]);
  const photoTitle = (p: Photo) => {
    const info = groupMap.get(p.id);
    return pick(formatNumberedTitle(p.title, info), formatNumberedTitle(p.titleEn, info));
  };

  const PlateCaption = ({ photo }: { photo: Photo }) => {
    const pTitle = photoTitle(photo);
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

  const renderCoverBlock = (seg: Extract<RenderSegment, { type: "cover" }>, index: number) => {
    const { block, isFirstCover } = seg;
    const cEyebrow = pick(block.eyebrow, block.eyebrowEn);
    const cTitle = pick(block.title, block.titleEn);
    const cSubtitle = locale === "zh" ? block.titleEn : block.title;
    const cBody = pick(block.body, block.bodyEn);

    if (block.style === "full" && block.imageUrl) {
      return (
        <section
          key={block.id}
          className={`relative flex w-full items-end overflow-hidden bg-black ${
            index === 0 ? "h-[68dvh] sm:h-[76dvh]" : "mx-auto max-w-[1320px] rounded-lg h-[52dvh] sm:h-[62dvh]"
          }`}
        >
          <img
            src={optImg(block.imageUrl, 1920, 85)}
            srcSet={optSrcSet(block.imageUrl, [828, 1200, 1920, 2048], 85)}
            sizes="100vw"
            fetchPriority={isFirstCover ? "high" : undefined}
            loading={isFirstCover ? "eager" : "lazy"}
            decoding="async"
            alt={cTitle}
            draggable={!copyrightGuard}
            onContextMenu={(e) => copyrightGuard && e.preventDefault()}
            className="absolute inset-0 h-full w-full object-cover opacity-80 animate-hero-breath"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/42 to-black/22"
          />
          <div className="relative z-10 mx-auto w-full max-w-[1320px] px-4 pb-8 sm:px-9 sm:pb-14 text-white space-y-3.5">
            {isFirstCover && (
              <ViewLink
                href="/collections"
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-white/75 hover:text-white transition"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>{locale === "en" ? "All Series" : "返回影集"}</span>
              </ViewLink>
            )}
            <div className="space-y-2 max-w-2xl">
              <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-white/75">
                {cEyebrow && <span className="tracking-[0.14em] uppercase">{cEyebrow}</span>}
                {isFirstCover && (
                  <span className="inline-flex items-center gap-1.5">
                    <Images className="h-3.5 w-3.5 opacity-80" />
                    {orderedPhotos.length} {locale === "en" ? "Plates" : "幅作品"}
                  </span>
                )}
              </div>
              {cTitle && (
                <h1 className={isFirstCover ? "text-3xl sm:text-5xl font-semibold tracking-tight" : "text-2xl sm:text-4xl font-semibold tracking-tight"}>
                  {cTitle}
                </h1>
              )}
              {cSubtitle && cSubtitle !== cTitle && (
                <p className="text-sm sm:text-base text-white/70">{cSubtitle}</p>
              )}
            </div>
            {cBody && (
              <p className="max-w-2xl text-sm sm:text-[15px] leading-7 text-white/82 pt-0.5 whitespace-pre-line">
                {cBody}
              </p>
            )}
          </div>
        </section>
      );
    }

    if (block.style === "split" && block.imageUrl) {
      return (
        <Reveal key={block.id}>
          <section className="mx-auto max-w-[1320px] px-4 sm:px-9">
            <div className="surface-card grid grid-cols-1 lg:grid-cols-12 overflow-hidden rounded-lg">
              <div className="lg:col-span-7 relative min-h-[280px] sm:min-h-[380px] overflow-hidden bg-[var(--bg-subtle)]">
                <img
                  src={optImg(block.imageUrl, 1200, 85)}
                  loading="lazy"
                  decoding="async"
                  alt={cTitle}
                  draggable={!copyrightGuard}
                  onContextMenu={(e) => copyrightGuard && e.preventDefault()}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="lg:col-span-5 flex flex-col justify-center p-6 sm:p-10 space-y-3.5">
                {isFirstCover && (
                  <ViewLink
                    href="/collections"
                    className="inline-flex items-center gap-1.5 text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] transition pb-1"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>{locale === "en" ? "All Series" : "返回影集"}</span>
                  </ViewLink>
                )}
                {cEyebrow && (
                  <span className="text-xs tracking-[0.16em] uppercase text-[var(--fg-subtle)]">
                    {cEyebrow}
                  </span>
                )}
                {cTitle && (
                  <h2 className="text-2xl sm:text-3xl font-semibold text-[var(--fg)]">{cTitle}</h2>
                )}
                {cBody && (
                  <p className="text-sm sm:text-[15px] leading-7 text-[var(--fg-muted)] whitespace-pre-line">
                    {cBody}
                  </p>
                )}
              </div>
            </div>
          </section>
        </Reveal>
      );
    }

    // Minimalist Typographic Chapter / Title Page
    return (
      <Reveal key={block.id}>
        <section className="mx-auto max-w-2xl px-4 py-8 sm:px-9 sm:py-12 text-center space-y-3 border-y border-[var(--border)]">
          {isFirstCover && (
            <div className="pb-2">
              <ViewLink
                href="/collections"
                className="inline-flex items-center gap-1.5 text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] transition"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>{locale === "en" ? "All Series" : "返回影集"}</span>
              </ViewLink>
            </div>
          )}
          {cEyebrow && (
            <div className="text-xs tracking-[0.18em] uppercase text-[var(--fg-subtle)]">{cEyebrow}</div>
          )}
          {cTitle && (
            <h2 className="text-2xl sm:text-3xl font-semibold text-[var(--fg)]">{cTitle}</h2>
          )}
          {cBody && (
            <p className="text-sm sm:text-[15px] leading-7 text-[var(--fg-muted)] whitespace-pre-line">
              {cBody}
            </p>
          )}
        </section>
      </Reveal>
    );
  };

  return (
    <div className="min-h-dvh flex flex-col">
      <SiteHeader
        overlay={startsWithFullCover}
        photographerName={settings.photographerName}
        photographerNameEn={settings.photographerNameEn}
      />

      {/* Render Leading Full-Bleed Cover Outside Padded Container */}
      {startsWithFullCover && renderCoverBlock(segments[0] as Extract<RenderSegment, { type: "cover" }>, 0)}

      <div ref={spreadsContainerRef} className="flex-1 pt-10 sm:pt-18 space-y-16 sm:space-y-28">
        {segments.map((seg, idx) => {
          if (idx === 0 && startsWithFullCover) return null;

          if (seg.type === "cover") {
            return (
              <div key={seg.block.id} className="px-4 sm:px-0">
                {renderCoverBlock(seg, idx)}
              </div>
            );
          }

          if (seg.type === "annotated") {
            const { photo, block, lightboxIndex } = seg;
            const noteText = pick(block.sideNote, block.sideNoteEn);
            const noteLeft = block.noteAlign === "left";
            const isPortrait = (photo.height || 1068) > (photo.width || 1600);

            return (
              <Reveal key={block.id}>
                <div className="mx-auto max-w-[1320px] px-4 sm:px-9 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
                  <figure
                    onClick={() => setLightboxIdx(lightboxIndex)}
                    className={`group cursor-pointer ${
                      noteLeft
                        ? isPortrait
                          ? "lg:col-span-5 lg:col-start-8 lg:order-2"
                          : "lg:col-span-7 lg:order-2"
                        : isPortrait
                        ? "lg:col-span-5 lg:col-start-2"
                        : "lg:col-span-7"
                    }`}
                  >
                    <GalleryImage
                      photoId={photo.id}
                      src={photo.url}
                      alt={pick(photo.title, photo.titleEn)}
                      ambient={photo.ambient}
                      blurData={photo.blurData}
                      aspectRatio={`${photo.width || 1600} / ${photo.height || 1068}`}
                      className="w-full"
                    />
                    <PlateCaption photo={photo} />
                  </figure>

                  <div
                    className={`space-y-3 ${
                      noteLeft
                        ? "lg:col-span-5 lg:order-1"
                        : "lg:col-span-5"
                    }`}
                  >
                    <div className="border-l-2 border-[var(--border)] pl-5 space-y-2.5">
                      <h3 className="text-lg sm:text-xl font-semibold text-[var(--fg)]">
                        {photoTitle(photo)}
                      </h3>
                      <p className="text-sm sm:text-[15px] leading-7 text-[var(--fg-muted)] whitespace-pre-line">
                        {noteText}
                      </p>
                      {(photo.location || photo.takenAt) && (
                        <div className="pt-1 text-xs text-[var(--fg-subtle)]">
                          {[pick(photo.location, photo.locationEn), photo.takenAt].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          }

          if (seg.type === "single") {
            const { photo, lightboxIndex, alignRight } = seg;
            const isPortrait = (photo.height || 1068) > (photo.width || 1600);
            return (
              <Reveal key={`single-${photo.id}`}>
                <div className="mx-auto max-w-[1320px] px-4 sm:px-9">
                  <figure
                    onClick={() => setLightboxIdx(lightboxIndex)}
                    className={`group cursor-pointer ${
                      isPortrait
                        ? "mx-auto max-w-[420px]"
                        : alignRight
                        ? "max-w-[840px] md:ml-auto"
                        : "max-w-[840px]"
                    }`}
                  >
                    <GalleryImage
                      photoId={photo.id}
                      src={photo.url}
                      alt={pick(photo.title, photo.titleEn)}
                      ambient={photo.ambient}
                      blurData={photo.blurData}
                      aspectRatio={`${photo.width || 1600} / ${photo.height || 1068}`}
                      className="w-full"
                    />
                    <PlateCaption photo={photo} />
                  </figure>
                </div>
              </Reveal>
            );
          }

          const { left, right } = seg;
          const leftPortrait = (left.photo.height || 1068) > (left.photo.width || 1600);
          const rightPortrait = (right.photo.height || 1068) > (right.photo.width || 1600);

          return (
            <Reveal key={`pair-${left.photo.id}-${right.photo.id}`}>
              <div className="mx-auto max-w-[1320px] px-4 sm:px-9 grid grid-cols-1 gap-12 md:grid-cols-12 items-start">
                <figure
                  data-parallax-speed="-12"
                  onClick={() => setLightboxIdx(left.lightboxIndex)}
                  className={`group cursor-pointer will-change-transform ${
                    leftPortrait ? "md:col-span-4 md:col-start-2" : "md:col-span-5"
                  }`}
                >
                  <GalleryImage
                    photoId={left.photo.id}
                    src={left.photo.url}
                    alt={pick(left.photo.title, left.photo.titleEn)}
                    ambient={left.photo.ambient}
                    blurData={left.photo.blurData}
                    aspectRatio={`${left.photo.width || 1600} / ${left.photo.height || 1068}`}
                    className="w-full"
                  />
                  <PlateCaption photo={left.photo} />
                </figure>

                <figure
                  data-parallax-speed="16"
                  onClick={() => setLightboxIdx(right.lightboxIndex)}
                  className={`group cursor-pointer md:mt-20 will-change-transform ${
                    rightPortrait ? "md:col-span-4 md:col-start-8" : "md:col-span-6 md:col-start-7"
                  }`}
                >
                  <GalleryImage
                    photoId={right.photo.id}
                    src={right.photo.url}
                    alt={pick(right.photo.title, right.photo.titleEn)}
                    ambient={right.photo.ambient}
                    blurData={right.photo.blurData}
                    aspectRatio={`${right.photo.width || 1600} / ${right.photo.height || 1068}`}
                    className="w-full"
                  />
                  <PlateCaption photo={right.photo} />
                </figure>
              </div>
            </Reveal>
          );
        })}

        {/* End-of-Monograph Next Series Handoff */}
        {nextCollection && (
          <Reveal>
            <section className="mx-auto max-w-[1320px] px-4 sm:px-9 pt-6">
              <div className="border-t border-[var(--border)] pt-10">
                <ViewLink
                  href={`/collections/${nextCollection.slug}`}
                  className="group photo-frame relative block h-48 sm:h-64 w-full overflow-hidden rounded-lg bg-black"
                >
                  {nextCollection.coverUrl && (
                    <img
                      src={optImg(nextCollection.coverUrl, 1200, 85)}
                      loading="lazy"
                      decoding="async"
                      alt={pick(nextCollection.title, nextCollection.titleEn)}
                      className="h-full w-full object-cover opacity-72 transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                    />
                  )}
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-r from-black/82 via-black/42 to-black/25"
                  />
                  <div className="absolute inset-0 flex items-center justify-between gap-6 px-6 sm:px-10 text-white">
                    <div className="space-y-1.5 min-w-0">
                      <span className="text-xs tracking-[0.16em] uppercase text-white/70">
                        {locale === "en" ? "Next Series" : "下一部影集"}
                      </span>
                      <h2 className="truncate text-2xl sm:text-3xl font-semibold">
                        {pick(nextCollection.title, nextCollection.titleEn)}
                      </h2>
                      <p className="text-xs sm:text-sm text-white/75">
                        {[nextCollection.period, `${nextCollection.photoCount} ${locale === "en" ? "Photos" : "幅"}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <span className="inline-flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/10 backdrop-blur-md transition-transform duration-300 group-hover:translate-x-1">
                      <ArrowRight className="h-5 w-5" />
                    </span>
                  </div>
                </ViewLink>
              </div>
            </section>
          </Reveal>
        )}
      </div>

      <SiteFooter settings={settings} />

      <Lightbox
        photos={orderedPhotos}
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
