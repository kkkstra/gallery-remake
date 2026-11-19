"use client";

import { useState } from "react";
import {
  Aperture,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Camera,
  Check,
  Compass,
  Download,
  Focus,
  Gauge,
  Layers,
  MapPin,
  Share2,
  Timer,
} from "lucide-react";
import type { Photo } from "@/lib/db/schema";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { GalleryImage } from "./GalleryImage";
import { Lightbox } from "./Lightbox";
import { PrintCardModal } from "./PrintCardModal";
import { PhotoMiniMap } from "./PhotoMiniMap";
import { ViewLink } from "./ViewLink";
import { usePreferences } from "./PreferencesProvider";

interface PhotoDetailClientProps {
  photo: Photo;
  allPhotos: Photo[];
  initialIndex: number;
  prevPhoto: Photo | null;
  nextPhoto: Photo | null;
  collections: { slug: string; title: string; titleEn: string }[];
  collectionsMap: Record<number, { slug: string; title: string; titleEn: string }[]>;
  settings: Record<string, string>;
}

export function PhotoDetailClient({
  photo,
  allPhotos,
  initialIndex,
  prevPhoto,
  nextPhoto,
  collections,
  collectionsMap,
  settings,
}: PhotoDetailClientProps) {
  const { locale, pick, categoryLabel } = usePreferences();
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [showPrint, setShowPrint] = useState(false);
  const [copied, setCopied] = useState(false);

  const title = pick(photo.title, photo.titleEn);
  const subtitle = locale === "zh" ? photo.titleEn : photo.title;
  const desc = pick(photo.description, photo.descriptionEn);
  const place = pick(photo.location, photo.locationEn);

  const handleShare = async () => {
    const url = window.location.href;
    if (typeof navigator.share === "function" && window.matchMedia("(max-width: 768px)").matches) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // Fallback
      }
    }
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="min-h-dvh flex flex-col">
      <SiteHeader
        photographerName={settings.photographerName}
        photographerNameEn={settings.photographerNameEn}
      />

      <main className="mx-auto w-full max-w-[1360px] flex-1 px-4 pt-5 sm:px-9 sm:pt-8 space-y-10">
        <div className="flex items-center justify-between text-sm text-[var(--fg-muted)]">
          <ViewLink href="/gallery" className="inline-flex items-center gap-1.5 hover:text-[var(--fg)] transition">
            <ArrowLeft className="h-4 w-4" />
            <span>{locale === "en" ? "Gallery" : "返回相册"}</span>
          </ViewLink>

          <div className="flex items-center gap-4">
            {prevPhoto && (
              <ViewLink
                href={`/photo/${prevPhoto.id}`}
                className="inline-flex items-center gap-1 hover:text-[var(--fg)] transition"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{locale === "en" ? "Prev" : "上一幅"}</span>
              </ViewLink>
            )}
            {nextPhoto && (
              <ViewLink
                href={`/photo/${nextPhoto.id}`}
                className="inline-flex items-center gap-1 hover:text-[var(--fg)] transition"
              >
                <span className="hidden sm:inline">{locale === "en" ? "Next" : "下一幅"}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </ViewLink>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Artwork Stage */}
          <div
            onClick={() => setLightboxIdx(initialIndex)}
            className="lg:col-span-8 group cursor-zoom-in"
          >
            <GalleryImage
              photoId={photo.id}
              src={photo.url}
              alt={title}
              ambient={photo.ambient}
              blurData={photo.blurData}
              aspectRatio={`${photo.width || 1600} / ${photo.height || 1068}`}
              className="w-full"
            />
          </div>

          {/* Metadata Column */}
          <aside className="lg:col-span-4 surface-card rounded-lg p-6 sm:p-7 space-y-6">
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--fg-muted)]">
                <span>{categoryLabel(photo.category)}</span>
                {collections.map((c) => (
                  <ViewLink
                    key={c.slug}
                    href={`/collections/${c.slug}`}
                    className="inline-flex items-center gap-1 text-[var(--fg)] underline underline-offset-4 decoration-[var(--border)]"
                  >
                    <Layers className="h-3.5 w-3.5 opacity-75" />
                    {pick(c.title, c.titleEn)}
                  </ViewLink>
                ))}
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-[var(--fg)]">{title}</h1>
                {subtitle && subtitle !== title && (
                  <p className="mt-0.5 text-sm text-[var(--fg-muted)]">{subtitle}</p>
                )}
              </div>
              {desc && <p className="text-sm leading-7 text-[var(--fg-muted)] pt-1">{desc}</p>}
            </div>

            {(photo.focalMm || photo.aperture || photo.shutter || photo.iso) && (
              <div className="grid grid-cols-4 gap-2 border-y border-[var(--border)] py-3.5">
                <div>
                  <div className="inline-flex items-center gap-1 text-xs text-[var(--fg-muted)]">
                    <Focus className="h-3 w-3" />
                    {locale === "en" ? "Focal" : "焦段"}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-[var(--fg)]">
                    {photo.focalMm ? `${photo.focalMm}mm` : "—"}
                  </div>
                </div>
                <div>
                  <div className="inline-flex items-center gap-1 text-xs text-[var(--fg-muted)]">
                    <Aperture className="h-3 w-3" />
                    {locale === "en" ? "Stop" : "光圈"}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-[var(--fg)]">
                    {photo.aperture || "—"}
                  </div>
                </div>
                <div>
                  <div className="inline-flex items-center gap-1 text-xs text-[var(--fg-muted)]">
                    <Timer className="h-3 w-3" />
                    {locale === "en" ? "Shutter" : "快门"}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-[var(--fg)]">
                    {photo.shutter || "—"}
                  </div>
                </div>
                <div>
                  <div className="inline-flex items-center gap-1 text-xs text-[var(--fg-muted)]">
                    <Gauge className="h-3 w-3" />
                    ISO
                  </div>
                  <div className="mt-1 text-sm font-semibold text-[var(--fg)]">
                    {photo.iso ?? "—"}
                  </div>
                </div>
              </div>
            )}

            <dl className="space-y-2.5 text-sm">
              {photo.camera && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="inline-flex items-center gap-1.5 text-[var(--fg-muted)]">
                    <Camera className="h-4 w-4 opacity-75" />
                    {locale === "en" ? "Camera" : "机身"}
                  </dt>
                  <dd className="text-right font-medium text-[var(--fg)]">
                    <ViewLink href={`/gallery?camera=${encodeURIComponent(photo.camera)}`} className="hover:underline underline-offset-4">
                      {photo.camera}
                    </ViewLink>
                  </dd>
                </div>
              )}
              {photo.lens && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="inline-flex items-center gap-1.5 text-[var(--fg-muted)]">
                    <Aperture className="h-4 w-4 opacity-75" />
                    {locale === "en" ? "Lens" : "镜头"}
                  </dt>
                  <dd className="text-right text-[var(--fg)]">
                    <ViewLink href={`/gallery?lens=${encodeURIComponent(photo.lens)}`} className="hover:underline underline-offset-4">
                      {photo.lens}
                    </ViewLink>
                  </dd>
                </div>
              )}
              {place && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="inline-flex items-center gap-1.5 text-[var(--fg-muted)]">
                    <MapPin className="h-4 w-4 opacity-75" />
                    {locale === "en" ? "Location" : "拍摄地"}
                  </dt>
                  <dd className="text-right text-[var(--fg)]">{place}</dd>
                </div>
              )}
              {photo.lat !== null && photo.lng !== null && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="inline-flex items-center gap-1.5 text-[var(--fg-muted)]">
                    <Compass className="h-4 w-4 opacity-75" />
                    {locale === "en" ? "Coords" : "经纬度"}
                  </dt>
                  <dd className="text-right text-xs text-[var(--fg-muted)]">
                    {Math.abs(photo.lat).toFixed(4)}°{photo.lat >= 0 ? "N" : "S"},{" "}
                    {Math.abs(photo.lng).toFixed(4)}°{photo.lng >= 0 ? "E" : "W"}
                  </dd>
                </div>
              )}
              {photo.takenAt && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="inline-flex items-center gap-1.5 text-[var(--fg-muted)]">
                    <Calendar className="h-4 w-4 opacity-75" />
                    {locale === "en" ? "Date" : "日期"}
                  </dt>
                  <dd className="text-right text-[var(--fg)]">{photo.takenAt}</dd>
                </div>
              )}
            </dl>

            {photo.lat !== null && photo.lng !== null && (
              <PhotoMiniMap
                photoId={photo.id}
                lat={photo.lat}
                lng={photo.lng}
                photoUrl={photo.url}
              />
            )}

            <div className="flex items-center gap-3 border-t border-[var(--border)] pt-4">
              <button
                type="button"
                onClick={() => setShowPrint(true)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2 text-xs sm:text-sm font-medium text-[var(--fg)] hover:opacity-85 transition cursor-pointer"
              >
                <Download className="h-4 w-4" />
                <span>{locale === "en" ? "Print" : "签名框"}</span>
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2 text-xs sm:text-sm font-medium text-[var(--fg)] hover:opacity-85 transition cursor-pointer"
              >
                {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                <span>{copied ? (locale === "en" ? "Copied" : "已复制") : locale === "en" ? "Share" : "分享链接"}</span>
              </button>
            </div>
          </aside>
        </div>
      </main>

      <SiteFooter settings={settings} />

      <Lightbox
        photos={allPhotos}
        activeIndex={lightboxIdx}
        collectionsMap={collectionsMap}
        photographerName={settings.photographerName}
        photographerNameEn={settings.photographerNameEn}
        onClose={() => setLightboxIdx(null)}
        onChangeIndex={setLightboxIdx}
      />

      {showPrint && (
        <PrintCardModal
          photo={photo}
          swatches={[]}
          photographerName={settings.photographerName}
          photographerNameEn={settings.photographerNameEn}
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  );
}
