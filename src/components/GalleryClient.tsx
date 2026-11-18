"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Aperture,
  Building2,
  Camera,
  ChevronDown,
  Images,
  LayoutGrid,
  MapPin,
  Mountain,
  Rows3,
  SlidersHorizontal,
  Tag,
  User,
  Users,
  X,
} from "lucide-react";
import type { Photo } from "@/lib/db/schema";
import { SiteHeader } from "./SiteHeader";
import { Lightbox } from "./Lightbox";
import { usePreferences } from "./PreferencesProvider";
import { CameraIllustration, LensIllustration } from "./GearIllustrations";

interface GalleryClientProps {
  photos: Photo[];
  collectionsMap: Record<number, { slug: string; title: string; titleEn: string }[]>;
  settings: Record<string, string>;
}

function CategoryIcon({ cat }: { cat: string }) {
  if (cat === "landscape") return <Mountain className="h-4 w-4 opacity-75" />;
  if (cat === "street") return <Users className="h-4 w-4 opacity-75" />;
  if (cat === "architecture") return <Building2 className="h-4 w-4 opacity-75" />;
  if (cat === "portrait") return <User className="h-4 w-4 opacity-75" />;
  return <Tag className="h-4 w-4 opacity-75" />;
}

function parseCameraLabel(full: string): { brand: string; model: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 1) return { brand: "", model: full };
  return { brand: parts[0], model: parts.slice(1).join(" ") };
}

function parseLensHeadline(lens: string, fallbackFocal?: number | null): { spec: string; sub: string } {
  const focalMatch = lens.match(/(\d{2,3})\s*mm/i) || lens.match(/\/(\d{2,3})V?\b/i);
  const focal = focalMatch ? `${focalMatch[1]}mm` : fallbackFocal ? `${fallbackFocal}mm` : "";
  const apMatch = lens.match(/f\/(\d+(?:\.\d+)?)/i) || lens.match(/\b(\d+(?:[.,]\d+)?)\/\d{2,3}/);
  const ap = apMatch ? `f/${apMatch[1].replace(",", ".")}` : "";
  const spec = [focal, ap].filter(Boolean).join(" ");
  return { spec: spec || lens, sub: lens };
}

const TARGET_ROW_RATIO = 4.3;

function buildJustifiedRows(
  list: Photo[],
  targetRatioSum = TARGET_ROW_RATIO,
  maxItems = 4
): { items: { photo: Photo; flatIdx: number }[]; sum: number; isLast: boolean }[] {
  const rows: { items: { photo: Photo; flatIdx: number }[]; sum: number; isLast: boolean }[] = [];
  let current: { photo: Photo; flatIdx: number }[] = [];
  let sum = 0;

  list.forEach((p, flatIdx) => {
    const ratio = Math.max(0.55, Math.min(2.4, (p.width || 1600) / (p.height || 1068)));
    current.push({ photo: p, flatIdx });
    sum += ratio;
    if (sum >= targetRatioSum || current.length >= maxItems) {
      rows.push({ items: current, sum, isLast: false });
      current = [];
      sum = 0;
    }
  });

  if (current.length > 0) {
    rows.push({ items: current, sum, isLast: true });
  } else if (rows.length > 0) {
    rows[rows.length - 1].isLast = true;
  }
  return rows;
}

export function GalleryClient({ photos, collectionsMap, settings }: GalleryClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale, pick, categoryLabel } = usePreferences();

  const initialCat = searchParams.get("category") || "all";
  const initialCamera = searchParams.get("camera") || "all";
  const initialLens = searchParams.get("lens") || "all";
  const initialView = searchParams.get("view") === "index" ? "index" : "mosaic";

  const [category, setCategoryState] = useState(initialCat);
  const [camera, setCameraState] = useState(initialCamera);
  const [lens, setLensState] = useState(initialLens);
  const [gearTab, setGearTab] = useState<"camera" | "lens">(
    initialLens !== "all" && initialCamera === "all" ? "lens" : "camera"
  );
  const [gearOpen, setGearOpen] = useState(initialCamera !== "all" || initialLens !== "all");
  const [view, setViewState] = useState<"mosaic" | "index">(initialView);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  // FLIP + Staggered Entrance animation refs
  const galleryRef = useRef<HTMLDivElement>(null);
  const prevRectsRef = useRef<Map<number, DOMRect> | null>(null);

  const captureSnapshot = useCallback(() => {
    if (typeof window === "undefined") return;
    const map = new Map<number, DOMRect>();
    galleryRef.current?.querySelectorAll<HTMLElement>("[data-photo-id]").forEach((el) => {
      const id = Number(el.dataset.photoId);
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.bottom > -300 && rect.top < window.innerHeight + 500) {
        map.set(id, rect);
      }
    });
    prevRectsRef.current = map;
  }, []);

  const changeCategory = (next: string) => {
    if (next === category) return;
    captureSnapshot();
    setCategoryState(next);
  };

  const changeCamera = (next: string) => {
    captureSnapshot();
    setCameraState(next);
    setLensState("all");
  };

  const changeLens = (next: string) => {
    captureSnapshot();
    setLensState(next);
  };

  const changeView = (next: "mosaic" | "index") => {
    if (next === view) return;
    captureSnapshot();
    setViewState(next);
  };

  const resetFilters = () => {
    captureSnapshot();
    setCategoryState("all");
    setCameraState("all");
    setLensState("all");
    router.replace("/gallery", { scroll: false });
  };

  // Run FLIP morph on staying items + staggered rise-in on entering items
  useLayoutEffect(() => {
    const prevRects = prevRectsRef.current;
    if (!prevRects) return;
    prevRectsRef.current = null;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const nodes = galleryRef.current?.querySelectorAll<HTMLElement>("[data-photo-id]");
    if (!nodes) return;

    let enterOrder = 0;
    nodes.forEach((el) => {
      el.getAnimations().forEach((a) => a.cancel());
      const id = Number(el.dataset.photoId);
      const last = el.getBoundingClientRect();
      if (last.width === 0 || last.bottom < -300 || last.top > window.innerHeight + 500) return;

      const first = prevRects.get(id);
      if (first) {
        const dx = first.left - last.left;
        const dy = first.top - last.top;
        const sx = first.width / last.width;
        const sy = first.height / last.height;

        if (Math.abs(dx) > 1 || Math.abs(dy) > 1 || Math.abs(sx - 1) > 0.02 || Math.abs(sy - 1) > 0.02) {
          el.style.transformOrigin = "top left";
          const anim = el.animate(
            [
              { transform: `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy})` },
              { transform: "translate3d(0, 0, 0) scale(1, 1)" },
            ],
            {
              duration: 420,
              easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            }
          );
          anim.onfinish = () => {
            el.style.transformOrigin = "";
          };
        }
      } else {
        const delay = Math.min(enterOrder * 30, 210);
        enterOrder += 1;
        el.animate(
          [
            { opacity: 0, transform: "translate3d(0, 18px, 0) scale(0.96)" },
            { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
          ],
          {
            duration: 380,
            delay,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            fill: "backwards",
          }
        );
      }
    });
  }, [view, category, camera, lens]);

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of photos) {
      if (p.category) map.set(p.category, (map.get(p.category) || 0) + 1);
    }
    return Array.from(map.entries());
  }, [photos]);

  const cameraStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of photos) {
      if (category !== "all" && p.category !== category) continue;
      if (p.camera) map.set(p.camera, (map.get(p.camera) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count, ...parseCameraLabel(name) }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [category, photos]);

  const lensStats = useMemo(() => {
    const map = new Map<string, { count: number; focalMm: number }>();
    for (const p of photos) {
      if (category !== "all" && p.category !== category) continue;
      if (gearTab === "camera" && camera !== "all" && p.camera !== camera) continue;
      if (!p.lens) continue;
      const prev = map.get(p.lens);
      if (prev) prev.count += 1;
      else map.set(p.lens, { count: 1, focalMm: p.focalMm || 50 });
    }
    return Array.from(map.entries())
      .map(([name, info]) => ({
        name,
        count: info.count,
        focalMm: info.focalMm,
        ...parseLensHeadline(name, info.focalMm),
      }))
      .sort((a, b) => a.focalMm - b.focalMm || a.name.localeCompare(b.name));
  }, [camera, category, gearTab, photos]);

  const filtered = useMemo(() => {
    return photos.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (camera !== "all" && p.camera !== camera) return false;
      if (lens !== "all" && p.lens !== lens) return false;
      return true;
    });
  }, [camera, category, lens, photos]);

  const mosaicRows = useMemo(() => buildJustifiedRows(filtered), [filtered]);

  const hasActiveFilter = category !== "all" || camera !== "all" || lens !== "all";

  const filterButtonText =
    [
      camera !== "all" ? parseCameraLabel(camera).model : "",
      lens !== "all" ? parseLensHeadline(lens).spec : "",
    ]
      .filter(Boolean)
      .join(" + ") || (locale === "en" ? "Filter" : "筛选");

  return (
    <div className="min-h-dvh pb-24">
      <SiteHeader
        photographerName={settings.photographerName}
        photographerNameEn={settings.photographerNameEn}
      />

      {/* Toolbar & Collapsible Gear Filter */}
      <div className="mx-auto max-w-[1440px] px-6 py-4 sm:px-9 border-b border-[var(--border)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-5 text-[15px]">
            <button
              type="button"
              onClick={() => changeCategory("all")}
              className={`inline-flex items-center gap-1.5 pb-1 transition cursor-pointer ${
                category === "all"
                  ? "text-[var(--fg)] font-semibold border-b-2 border-[var(--fg)]"
                  : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
              }`}
            >
              <Images className="h-4 w-4 opacity-75" />
              <span>{locale === "en" ? "All" : "全部"}</span>
              <span className="text-xs opacity-65">{photos.length}</span>
            </button>

            {categories.map(([cat, count]) => (
              <button
                key={cat}
                type="button"
                onClick={() => changeCategory(category === cat ? "all" : cat)}
                className={`inline-flex items-center gap-1.5 pb-1 transition cursor-pointer ${
                  category === cat
                    ? "text-[var(--fg)] font-semibold border-b-2 border-[var(--fg)]"
                    : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
                }`}
              >
                <CategoryIcon cat={cat} />
                <span>{categoryLabel(cat)}</span>
                <span className="text-xs opacity-60">{count}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2.5">
            {hasActiveFilter && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] transition cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
                <span>{locale === "en" ? "Reset" : "重置"}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setGearOpen((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition cursor-pointer ${
                camera !== "all" || lens !== "all"
                  ? "border-[var(--fg)] bg-[var(--fg)] text-[var(--bg)] font-medium"
                  : "border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--fg)] hover:opacity-85"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>{filterButtonText}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-250 ${
                  gearOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Icon-Only View Switcher */}
            <div className="flex items-center rounded-md border border-[var(--border)] overflow-hidden">
              <button
                type="button"
                onClick={() => changeView("mosaic")}
                aria-label={locale === "en" ? "Mosaic View" : "密铺视图"}
                title={locale === "en" ? "Mosaic View" : "密铺视图"}
                className={`p-2 transition-colors duration-200 cursor-pointer ${
                  view === "mosaic"
                    ? "bg-[var(--fg)] text-[var(--bg)]"
                    : "bg-[var(--bg-elevated)] text-[var(--fg-muted)] hover:text-[var(--fg)]"
                }`}
              >
                <Rows3 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => changeView("index")}
                aria-label={locale === "en" ? "Index View" : "索引视图"}
                title={locale === "en" ? "Index View" : "索引视图"}
                className={`p-2 transition-colors duration-200 cursor-pointer ${
                  view === "index"
                    ? "bg-[var(--fg)] text-[var(--bg)]"
                    : "bg-[var(--bg-elevated)] text-[var(--fg-muted)] hover:text-[var(--fg)]"
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Smooth Accordion Gear Drawer */}
        <div
          className={`grid transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            gearOpen ? "grid-rows-[1fr] opacity-100 pt-3.5" : "grid-rows-[0fr] opacity-0 pointer-events-none"
          }`}
        >
          <div className="overflow-hidden">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 space-y-3">
              {/* Dedicated Row 1: 相机 / 镜头 Switcher */}
              <div className="flex items-center gap-5 border-b border-[var(--border)] pb-2.5 text-sm">
                <button
                  type="button"
                  onClick={() => setGearTab("camera")}
                  className={`inline-flex items-center gap-1.5 pb-0.5 transition cursor-pointer ${
                    gearTab === "camera"
                      ? "text-[var(--fg)] font-semibold border-b-2 border-[var(--fg)] -mb-[11px] pb-[9px]"
                      : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
                  }`}
                >
                  <Camera className="h-4 w-4" />
                  <span>{locale === "en" ? "Camera" : "相机"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGearTab("lens");
                    if (camera !== "all") changeCamera("all");
                  }}
                  className={`inline-flex items-center gap-1.5 pb-0.5 transition cursor-pointer ${
                    gearTab === "lens"
                      ? "text-[var(--fg)] font-semibold border-b-2 border-[var(--fg)] -mb-[11px] pb-[9px]"
                      : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
                  }`}
                >
                  <Aperture className="h-4 w-4" />
                  <span>{locale === "en" ? "Lens" : "镜头"}</span>
                </button>
              </div>

              {/* Dedicated Row 2: Full-Width Options */}
              {gearTab === "camera" ? (
                <div key="gear-camera" className="space-y-2.5 animate-tab-in">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                    {cameraStats.map((item) => {
                      const active = camera === item.name;
                      return (
                        <button
                          key={item.name}
                          type="button"
                          onClick={() => changeCamera(active ? "all" : item.name)}
                          className={`group flex items-center gap-3 rounded-md border px-3 py-2 text-left transition cursor-pointer ${
                            active
                              ? "border-[var(--fg)] bg-[var(--bg)] ring-1 ring-[var(--fg)]"
                              : "border-[var(--border)] bg-[var(--bg)]/50 hover:border-[var(--fg-muted)]"
                          }`}
                        >
                          <CameraIllustration
                            name={item.name}
                            className="h-10 w-auto shrink-0 transition-transform duration-200 group-hover:scale-105"
                          />
                          <div className="min-w-0">
                            <div className="text-[10px] uppercase tracking-wider text-[var(--fg-subtle)]">
                              {item.brand}
                            </div>
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-xs sm:text-[13px] font-medium text-[var(--fg)] truncate">
                                {item.model}
                              </span>
                              <span className="text-[11px] text-[var(--fg-muted)] shrink-0">
                                ({item.count})
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Coupled Lens Sub-Row when a Camera is active */}
                  {camera !== "all" && lensStats.length > 0 && (
                    <div key={camera} className="flex flex-wrap items-center gap-2.5 border-t border-[var(--border)] pt-2.5 animate-tab-in">
                      <span className="inline-flex items-center gap-1 text-xs text-[var(--fg-muted)] mr-1">
                        <Aperture className="h-3.5 w-3.5" />
                        {locale === "en" ? "Lens:" : "镜头："}
                      </span>
                      {lensStats.map((l) => {
                        const activeLens = lens === l.name;
                        return (
                          <button
                            key={l.name}
                            type="button"
                            onClick={() => changeLens(activeLens ? "all" : l.name)}
                            className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-left transition cursor-pointer ${
                              activeLens
                                ? "border-[var(--fg)] bg-[var(--bg)] ring-1 ring-[var(--fg)]"
                                : "border-[var(--border)] bg-[var(--bg)]/50 hover:border-[var(--fg-muted)]"
                            }`}
                          >
                            <LensIllustration name={l.name} focalMm={l.focalMm} className="h-7 w-auto" />
                            <span className="text-xs font-medium text-[var(--fg)] whitespace-nowrap">
                              {l.spec}
                            </span>
                            <span className="text-[11px] text-[var(--fg-muted)]">({l.count})</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div key="gear-lens" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 animate-tab-in">
                  {lensStats.map((item) => {
                    const active = lens === item.name;
                    return (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => changeLens(active ? "all" : item.name)}
                        className={`group flex items-center gap-2.5 rounded-md border px-3 py-2 text-left transition cursor-pointer ${
                          active
                            ? "border-[var(--fg)] bg-[var(--bg)] ring-1 ring-[var(--fg)]"
                            : "border-[var(--border)] bg-[var(--bg)]/50 hover:border-[var(--fg-muted)]"
                        }`}
                      >
                        <LensIllustration
                          name={item.name}
                          focalMm={item.focalMm}
                          className="h-9 w-14 shrink-0 transition-transform duration-200 group-hover:scale-105"
                        />
                        <div className="min-w-0">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-xs sm:text-[13px] font-semibold text-[var(--fg)] whitespace-nowrap">
                              {item.spec}
                            </span>
                            <span className="text-[11px] text-[var(--fg-muted)] shrink-0">
                              ({item.count})
                            </span>
                          </div>
                          <div className="text-[11px] text-[var(--fg-subtle)] truncate">
                            {item.sub}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Works Canvas (FLIP-animated across both Filter & Layout transitions) */}
      <div ref={galleryRef}>
        {filtered.length === 0 ? (
          <div className="mx-auto max-w-xl py-28 text-center text-sm text-[var(--fg-muted)]">
            {locale === "en" ? "No photos match current filters." : "当前筛选条件下暂无匹配作品。"}
          </div>
        ) : view === "mosaic" ? (
          /* View 1: Tight Seamless Edge-to-Edge Mosaic */
          <main className="mx-auto max-w-[1440px] px-4 sm:px-6 pt-4 space-y-2">
            {mosaicRows.map((row, rIdx) => {
              const needsSpacer = row.isLast && row.sum < TARGET_ROW_RATIO * 0.88;
              const spacerGrow = needsSpacer ? Math.max(0, TARGET_ROW_RATIO - row.sum) : 0;

              return (
                <div key={rIdx} className="flex flex-col sm:flex-row gap-2">
                  {row.items.map(({ photo, flatIdx }) => {
                    const ratio = Math.max(0.55, Math.min(2.4, (photo.width || 1600) / (photo.height || 1068)));
                    const title = pick(photo.title, photo.titleEn);
                    const place = pick(photo.location, photo.locationEn);
                    return (
                      <figure
                        key={photo.id}
                        data-photo-id={photo.id}
                        onClick={() => setLightboxIdx(flatIdx)}
                        style={{ flexGrow: ratio, flexBasis: "0%" }}
                        className="group relative cursor-pointer overflow-hidden bg-[var(--bg-elevated)] will-change-transform"
                      >
                        <img
                          src={photo.url}
                          alt={title}
                          style={{ aspectRatio: `${photo.width || 1600} / ${photo.height || 1068}` }}
                          className="w-full h-full block object-cover transition duration-600 ease-out group-hover:scale-[1.03]"
                        />
                        <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/85 via-black/30 to-transparent px-4 py-3.5 text-sm text-zinc-100 opacity-0 translate-y-1 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0">
                          <div className="min-w-0">
                            <div className="truncate font-medium">{title}</div>
                            {place && (
                              <div className="inline-flex items-center gap-1 truncate text-xs text-zinc-300">
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span className="truncate">{place.split(",")[0]}</span>
                              </div>
                            )}
                          </div>
                          <span className="inline-flex items-center gap-1 shrink-0 text-xs text-zinc-300">
                            <Aperture className="h-3 w-3" />
                            {[photo.focalMm ? `${photo.focalMm}mm` : "", photo.aperture].filter(Boolean).join(" ")}
                          </span>
                        </figcaption>
                      </figure>
                    );
                  })}
                  {spacerGrow > 0 && (
                    <div
                      aria-hidden="true"
                      style={{ flexGrow: spacerGrow, flexBasis: "0%" }}
                      className="hidden sm:block pointer-events-none"
                    />
                  )}
                </div>
              );
            })}
          </main>
        ) : (
          /* View 2: Dense Span-Aware Bento Index */
          <main className="mx-auto max-w-[1440px] px-6 sm:px-9 pt-7">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:auto-rows-[305px] grid-flow-dense">
              {filtered.map((photo, flatIdx) => {
                const isPortrait = (photo.height || 1068) > (photo.width || 1600) * 1.1;
                const title = pick(photo.title, photo.titleEn);
                const place = pick(photo.location, photo.locationEn);

                return (
                  <figure
                    key={photo.id}
                    data-photo-id={photo.id}
                    onClick={() => setLightboxIdx(flatIdx)}
                    className={`group flex flex-col cursor-pointer will-change-transform ${
                      isPortrait ? "sm:row-span-2" : "sm:row-span-1"
                    }`}
                  >
                    <div className="relative flex-1 min-h-[240px] sm:min-h-0 overflow-hidden bg-[var(--bg-elevated)]">
                      <img
                        src={photo.url}
                        alt={title}
                        className="h-full w-full block object-cover transition duration-600 ease-out group-hover:scale-[1.03]"
                      />
                    </div>
                    <figcaption className="pt-2.5 shrink-0 flex items-center justify-between gap-3 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium text-[var(--fg)] truncate">{title}</span>
                        {place && (
                          <span className="inline-flex items-center gap-0.5 text-xs text-[var(--fg-muted)] shrink-0">
                            <MapPin className="h-3 w-3 opacity-70" />
                            {place.split(",")[0]}
                          </span>
                        )}
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs text-[var(--fg-muted)] shrink-0">
                        <Aperture className="h-3 w-3 opacity-70" />
                        {[photo.focalMm ? `${photo.focalMm}mm` : "", photo.aperture].filter(Boolean).join(" ")}
                      </span>
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          </main>
        )}
      </div>

      <Lightbox
        photos={filtered}
        activeIndex={lightboxIdx}
        collectionsMap={collectionsMap}
        onClose={() => setLightboxIdx(null)}
        onChangeIndex={setLightboxIdx}
      />
    </div>
  );
}
