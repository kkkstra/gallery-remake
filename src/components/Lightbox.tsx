"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Aperture,
  Calendar,
  Camera,
  ChevronLeft,
  ChevronRight,
  Compass,
  ExternalLink,
  Focus,
  Gauge,
  Layers,
  MapPin,
  Maximize2,
  PanelRight,
  Tag,
  Timer,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { Photo } from "@/lib/db/schema";
import { usePreferences } from "./PreferencesProvider";

interface HistogramData {
  r: number[];
  g: number[];
  b: number[];
  lum: number[];
}

function smoothPath(bins: number[], w = 280, h = 64): string {
  const pts = bins.map(
    (v, i) => `${((i / (bins.length - 1)) * w).toFixed(1)},${(h - v * (h - 4)).toFixed(1)}`
  );
  return `M0,${h} L${pts.join(" L")} L${w},${h} Z`;
}

function formatRatio(w: number, h: number): string {
  if (!w || !h) return "";
  const r = w / h;
  if (Math.abs(r - 1.5) < 0.04) return "3:2";
  if (Math.abs(r - 0.667) < 0.04) return "2:3";
  if (Math.abs(r - 1.333) < 0.04) return "4:3";
  if (Math.abs(r - 0.75) < 0.04) return "3:4";
  if (Math.abs(r - 1.777) < 0.05) return "16:9";
  if (Math.abs(r - 1) < 0.03) return "1:1";
  return `${r.toFixed(2)}:1`;
}

interface LightboxProps {
  photos: Photo[];
  activeIndex: number | null;
  collectionsMap?: Record<number, { slug: string; title: string; titleEn: string }[]>;
  onClose: () => void;
  onChangeIndex: (index: number) => void;
}

export function Lightbox({
  photos,
  activeIndex,
  collectionsMap,
  onClose,
  onChangeIndex,
}: LightboxProps) {
  const { locale, theme, pick, categoryLabel } = usePreferences();
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [showPanel, setShowPanel] = useState(true);
  const [hist, setHist] = useState<HistogramData | null>(null);

  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number; moved: boolean } | null>(null);

  const isDark = theme === "dark";
  const photo = activeIndex !== null ? photos[activeIndex] : null;
  const isZoomed = scale > 1.02;

  const resetZoom = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
    setDragging(false);
  };

  useEffect(() => {
    resetZoom();
  }, [activeIndex]);

  useEffect(() => {
    if (activeIndex === null) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onChangeIndex((activeIndex - 1 + photos.length) % photos.length);
      if (e.key === "ArrowRight") onChangeIndex((activeIndex + 1) % photos.length);
      if (e.key.toLowerCase() === "i") setShowPanel((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [activeIndex, onChangeIndex, onClose, photos.length]);

  useEffect(() => {
    if (!photo) return;
    let cancelled = false;
    setHist(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = photo.url;
    img.onload = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement("canvas");
        const size = 96;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        const bins = 56;
        const r = new Array(bins).fill(0);
        const g = new Array(bins).fill(0);
        const b = new Array(bins).fill(0);
        const lum = new Array(bins).fill(0);
        for (let i = 0; i < data.length; i += 4) {
          const rv = data[i];
          const gv = data[i + 1];
          const bv = data[i + 2];
          const lv = 0.2126 * rv + 0.7152 * gv + 0.0722 * bv;
          r[Math.min(bins - 1, Math.floor((rv / 256) * bins))]++;
          g[Math.min(bins - 1, Math.floor((gv / 256) * bins))]++;
          b[Math.min(bins - 1, Math.floor((bv / 256) * bins))]++;
          lum[Math.min(bins - 1, Math.floor((lv / 256) * bins))]++;
        }
        const peak = Math.max(...r, ...g, ...b, ...lum, 1);
        setHist({
          r: r.map((v) => v / peak),
          g: g.map((v) => v / peak),
          b: b.map((v) => v / peak),
          lum: lum.map((v) => v / peak),
        });
      } catch {
        // ignore CORS
      }
    };
    return () => {
      cancelled = true;
    };
  }, [photo]);

  if (activeIndex === null || !photo) return null;

  const zoomInStep = () => {
    setScale((s) => Math.min(4, Number((s < 1.5 ? 2 : s + 0.75).toFixed(2))));
  };

  const zoomOutStep = () => {
    setScale((s) => {
      const next = Number((s - 0.75).toFixed(2));
      if (next <= 1.05) {
        setPan({ x: 0, y: 0 });
        return 1;
      }
      return next;
    });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLImageElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
      moved: false,
    };
    if (isZoomed) setDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLImageElement>) => {
    const start = dragStartRef.current;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.hypot(dx, dy) > 4) start.moved = true;
    if (isZoomed && start.moved) {
      setPan({ x: start.panX + dx, y: start.panY + dy });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLImageElement>) => {
    const start = dragStartRef.current;
    dragStartRef.current = null;
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    // Single click without drag toggles zoom in/out
    if (start && !start.moved) {
      if (isZoomed) resetZoom();
      else setScale(2.2);
    }
  };

  const handleStageWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setScale((prev) => {
      const next = Math.min(4, Math.max(1, prev - e.deltaY * 0.0025));
      if (next <= 1.02) {
        setPan({ x: 0, y: 0 });
        return 1;
      }
      return next;
    });
  };

  const belongingCols = collectionsMap?.[photo.id] ?? [];
  const title = pick(photo.title, photo.titleEn);
  const subtitle = locale === "zh" ? photo.titleEn : photo.title;
  const desc = pick(photo.description, photo.descriptionEn);
  const place = pick(photo.location, photo.locationEn);

  const gridStroke = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  const baseLine = isDark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.16)";
  const lumFill = isDark ? "rgba(255,255,255,0.12)" : "rgba(20,21,24,0.10)";
  const lumStroke = isDark ? "rgba(255,255,255,0.88)" : "rgba(20,21,24,0.82)";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col lg:flex-row bg-[var(--bg)] text-[var(--fg)] select-none animate-lightbox-in"
      style={
        isDark
          ? {
              backgroundImage: `radial-gradient(circle at 38% 48%, ${photo.ambient || "#1e2024"}55 0%, #0B0B0D 72%)`,
            }
          : undefined
      }
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Left/Center Photo Canvas */}
      <div className="relative flex flex-1 min-w-0 min-h-0 flex-col justify-between">
        <div className="flex items-center justify-between px-6 py-4 text-sm z-20">
          <div className="flex items-center gap-3 text-[var(--fg-muted)]">
            <span className="font-medium text-[var(--fg)]">
              {String(activeIndex + 1).padStart(2, "0")} / {String(photos.length).padStart(2, "0")}
            </span>
            {place && (
              <>
                <span className="opacity-40">·</span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 opacity-70" />
                  {place}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-[var(--fg-muted)]">
            {isZoomed && (
              <button
                type="button"
                onClick={resetZoom}
                title="点击还原 100%"
                className="rounded border border-[var(--border)] px-2 py-0.5 text-xs font-medium text-[var(--fg)] hover:opacity-80 transition mr-1"
              >
                {Math.round(scale * 100)}%
              </button>
            )}
            <button
              type="button"
              onClick={zoomOutStep}
              disabled={!isZoomed}
              title="缩小"
              aria-label="缩小"
              className="p-2 hover:text-[var(--fg)] disabled:opacity-30 disabled:pointer-events-none transition"
            >
              <ZoomOut className="h-5 w-5 stroke-[1.6]" />
            </button>
            <button
              type="button"
              onClick={zoomInStep}
              disabled={scale >= 4}
              title="放大（放大后可按住拖拽图片）"
              aria-label="放大"
              className="p-2 hover:text-[var(--fg)] disabled:opacity-30 disabled:pointer-events-none transition"
            >
              <ZoomIn className="h-5 w-5 stroke-[1.6]" />
            </button>
            <button
              type="button"
              onClick={() => setShowPanel((v) => !v)}
              title={showPanel ? "收起信息栏 (I)" : "展开信息栏 (I)"}
              aria-label="切换信息栏"
              className={`p-2 transition ${showPanel ? "text-[var(--fg)]" : "hover:text-[var(--fg)]"}`}
            >
              <PanelRight className="h-5 w-5 stroke-[1.6]" />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="关闭 (Esc)"
              aria-label="关闭灯箱"
              className="p-2 hover:text-[var(--fg)] transition"
            >
              <X className="h-5 w-5 stroke-[1.6]" />
            </button>
          </div>
        </div>

        <div
          onWheel={handleStageWheel}
          className="relative flex flex-1 min-h-0 items-center justify-center overflow-hidden px-14 py-2"
        >
          {photos.length > 1 && (
            <button
              type="button"
              onClick={() => onChangeIndex((activeIndex - 1 + photos.length) % photos.length)}
              aria-label="上一张"
              className="absolute left-3 sm:left-5 z-20 p-2.5 text-[var(--fg-muted)] hover:text-[var(--fg)] transition"
            >
              <ChevronLeft className="h-7 w-7 stroke-[1.5]" />
            </button>
          )}

          <img
            key={photo.id}
            src={photo.url}
            alt={title}
            draggable={false}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale})`,
              transition: dragging ? "none" : "transform 240ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
            className={`max-h-full max-w-full object-contain touch-none animate-photo-switch ${
              isZoomed
                ? dragging
                  ? "cursor-grabbing"
                  : "cursor-grab"
                : "cursor-zoom-in"
            }`}
          />

          {photos.length > 1 && (
            <button
              type="button"
              onClick={() => onChangeIndex((activeIndex + 1) % photos.length)}
              aria-label="下一张"
              className="absolute right-3 sm:right-5 z-20 p-2.5 text-[var(--fg-muted)] hover:text-[var(--fg)] transition"
            >
              <ChevronRight className="h-7 w-7 stroke-[1.5]" />
            </button>
          )}
        </div>

        {/* Bottom Filmstrip */}
        {photos.length > 1 && (
          <div className="flex items-center justify-center gap-2 px-6 py-4 overflow-x-auto no-scrollbar z-20">
            {photos.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangeIndex(idx)}
                className={`h-11 w-16 shrink-0 overflow-hidden transition-all duration-200 ${
                  idx === activeIndex ? "opacity-100 ring-2 ring-[var(--fg)] scale-105" : "opacity-30 hover:opacity-70"
                }`}
              >
                <img src={item.url} alt={item.title} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right Theme-Synced Metadata & Optical Inspector (Smooth Animated Collapse/Expand) */}
      <div
        aria-hidden={!showPanel}
        className={`shrink-0 overflow-hidden z-20 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
          showPanel
            ? "max-h-[46dvh] lg:max-h-none lg:w-96 opacity-100"
            : "max-h-0 lg:max-h-none lg:w-0 opacity-0 pointer-events-none"
        }`}
      >
        <aside
          className={`w-full lg:w-96 h-full border-t lg:border-t-0 lg:border-l border-[var(--border)] bg-[var(--bg-elevated)] px-7 py-6 flex flex-col justify-between gap-6 overflow-y-auto transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
            showPanel ? "translate-y-0 lg:translate-x-0" : "translate-y-4 lg:translate-y-0 lg:translate-x-8"
          }`}
        >
          <div className="space-y-6">
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--fg-muted)]">
                <span className="inline-flex items-center gap-1">
                  <Tag className="h-3.5 w-3.5 opacity-75" />
                  {categoryLabel(photo.category)}
                </span>
                {belongingCols.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/collections/${c.slug}`}
                    onClick={onClose}
                    className="inline-flex items-center gap-1 text-[var(--fg)] underline underline-offset-4 decoration-[var(--border)] hover:opacity-80"
                  >
                    <Layers className="h-3.5 w-3.5 opacity-75" />
                    {pick(c.title, c.titleEn)}
                  </Link>
                ))}
              </div>

              <div>
                <h2 className="text-xl font-semibold text-[var(--fg)] leading-snug">{title}</h2>
                {subtitle && subtitle !== title && (
                  <p className="mt-0.5 text-sm text-[var(--fg-muted)]">{subtitle}</p>
                )}
              </div>

              {desc && (
                <p className="pt-1 text-sm leading-relaxed text-[var(--fg-muted)] select-text">
                  {desc}
                </p>
              )}
            </div>

            {hist && (
              <div className="space-y-2 border-t border-[var(--border)] pt-4">
                <div className="flex items-center justify-between text-xs text-[var(--fg-muted)]">
                  <span className="inline-flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5" />
                    {locale === "en" ? "Histogram" : "直方图"}
                  </span>
                  <span>RGB · Luma</span>
                </div>
                <svg viewBox="0 0 280 64" className="h-16 w-full overflow-visible" aria-label="直方图">
                  <line x1="70" y1="0" x2="70" y2="64" stroke={gridStroke} />
                  <line x1="140" y1="0" x2="140" y2="64" stroke={gridStroke} />
                  <line x1="210" y1="0" x2="210" y2="64" stroke={gridStroke} />
                  <line x1="0" y1="64" x2="280" y2="64" stroke={baseLine} />
                  <path d={smoothPath(hist.r)} fill="rgba(239,68,68,0.16)" stroke="rgba(239,68,68,0.65)" strokeWidth="1" />
                  <path d={smoothPath(hist.g)} fill="rgba(34,197,94,0.14)" stroke="rgba(34,197,94,0.6)" strokeWidth="1" />
                  <path d={smoothPath(hist.b)} fill="rgba(59,130,246,0.18)" stroke="rgba(59,130,246,0.68)" strokeWidth="1" />
                  <path d={smoothPath(hist.lum)} fill={lumFill} stroke={lumStroke} strokeWidth="1.25" />
                </svg>
              </div>
            )}

            <div className="space-y-4 border-t border-[var(--border)] pt-4 text-sm">
              {(photo.camera || photo.lens) && (
                <dl className="space-y-2.5">
                  {photo.camera && (
                    <div className="flex items-center justify-between gap-3">
                      <dt className="inline-flex items-center gap-1.5 text-[var(--fg-muted)] shrink-0">
                        <Camera className="h-4 w-4 opacity-75" />
                        {locale === "en" ? "Camera" : "机身"}
                      </dt>
                      <dd className="text-right font-medium text-[var(--fg)]">
                        <Link
                          href={`/gallery?camera=${encodeURIComponent(photo.camera)}`}
                          onClick={onClose}
                          className="hover:underline underline-offset-4"
                        >
                          {photo.camera}
                        </Link>
                      </dd>
                    </div>
                  )}
                  {photo.lens && (
                    <div className="flex items-center justify-between gap-3">
                      <dt className="inline-flex items-center gap-1.5 text-[var(--fg-muted)] shrink-0">
                        <Aperture className="h-4 w-4 opacity-75" />
                        {locale === "en" ? "Lens" : "镜头"}
                      </dt>
                      <dd className="text-right text-[var(--fg)]">
                        <Link
                          href={`/gallery?lens=${encodeURIComponent(photo.lens)}`}
                          onClick={onClose}
                          className="hover:underline underline-offset-4"
                        >
                          {photo.lens}
                        </Link>
                      </dd>
                    </div>
                  )}
                </dl>
              )}

              {(photo.focalMm || photo.aperture || photo.shutter || photo.iso) && (
                <div className="grid grid-cols-4 gap-2 border-y border-[var(--border)] py-3">
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
                {place && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="inline-flex items-center gap-1.5 text-[var(--fg-muted)] shrink-0">
                      <MapPin className="h-4 w-4 opacity-75" />
                      {locale === "en" ? "Location" : "拍摄地"}
                    </dt>
                    <dd className="text-right text-[var(--fg)]">{place}</dd>
                  </div>
                )}
                {photo.lat !== null && photo.lng !== null && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="inline-flex items-center gap-1.5 text-[var(--fg-muted)] shrink-0">
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
                    <dt className="inline-flex items-center gap-1.5 text-[var(--fg-muted)] shrink-0">
                      <Calendar className="h-4 w-4 opacity-75" />
                      {locale === "en" ? "Date" : "日期"}
                    </dt>
                    <dd className="text-right text-[var(--fg)]">{photo.takenAt}</dd>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <dt className="inline-flex items-center gap-1.5 text-[var(--fg-muted)] shrink-0">
                    <Maximize2 className="h-4 w-4 opacity-75" />
                    {locale === "en" ? "Size" : "画幅"}
                  </dt>
                  <dd className="text-right text-[var(--fg-muted)]">
                    {photo.width} × {photo.height} ({formatRatio(photo.width, photo.height)})
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-[var(--border)] pt-4 text-xs text-[var(--fg-muted)]">
            <a
              href={photo.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-[var(--fg)] hover:opacity-75 transition"
            >
              <ExternalLink className="h-4 w-4" />
              <span>{locale === "en" ? "Original" : "查看原图"}</span>
            </a>
            <span>← / → · ESC</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
