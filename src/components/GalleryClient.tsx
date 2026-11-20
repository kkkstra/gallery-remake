"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Aperture,
  ArrowDownUp,
  Building2,
  Camera,
  ChevronDown,
  Grid3x3,
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
import { SiteFooter } from "./SiteFooter";
import { Lightbox } from "./Lightbox";
import { GalleryImage } from "./GalleryImage";
import { usePreferences } from "./PreferencesProvider";
import {
  CameraIllustration,
  LensIllustration,
  parseCameraLabel,
  parseLensHeadline,
} from "./GearIllustrations";

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
  const qView = searchParams.get("view");
  const initialView: "mosaic" | "index" | "sheet" =
    qView === "index" ? "index" : qView === "sheet" ? "sheet" : "mosaic";
  const initialSort: "default" | "time" =
    searchParams.get("sort") === "time" ? "time" : "default";

  const [category, setCategoryState] = useState(initialCat);
  const [camera, setCameraState] = useState(initialCamera);
  const [lens, setLensState] = useState(initialLens);
  const [sortBy, setSortBy] = useState<"default" | "time">(initialSort);
  const [gearTab, setGearTab] = useState<"camera" | "lens">(
    initialLens !== "all" && initialCamera === "all" ? "lens" : "camera"
  );
  const [gearOpen, setGearOpen] = useState(initialCamera !== "all" || initialLens !== "all");
  const [view, setViewState] = useState<"mosaic" | "index" | "sheet">(initialView);
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

  const changeView = (next: "mosaic" | "index" | "sheet") => {
    if (next === view) return;
    captureSnapshot();
    setViewState(next);
  };

  const changeSort = (next: "default" | "time") => {
    if (next === sortBy) return;
    captureSnapshot();
    setSortBy(next);
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
  }, [view, category, camera, lens, sortBy]);

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
      .sort((a, b) => a.sortFocal - b.sortFocal || a.name.localeCompare(b.name));
  }, [camera, category, gearTab, photos]);

  const filtered = useMemo(() => {
    return photos
      .filter((p) => {
        if (category !== "all" && p.category !== category) return false;
        if (camera !== "all" && p.camera !== camera) return false;
        if (lens !== "all" && p.lens !== lens) return false;
        return true;
      })
      .sort((a, b) =>
        sortBy === "time"
          ? (b.takenAt || "").localeCompare(a.takenAt || "") || a.sortOrder - b.sortOrder || b.id - a.id
          : a.sortOrder - b.sortOrder || b.id - a.id
      );
  }, [camera, category, lens, photos, sortBy]);

  // Sync URL query params (e.g. when jumping from Global ⌘K Search)
  useEffect(() => {
    const qCat = searchParams.get("category") || "all";
    const qCam = searchParams.get("camera") || "all";
    const qLens = searchParams.get("lens") || "all";
    const qPhotoId = Number(searchParams.get("photo") || 0);

    if (qPhotoId) {
      setCategoryState("all");
      setCameraState("all");
      setLensState("all");
      const sortedAll = [...photos].sort((a, b) =>
        sortBy === "time"
          ? (b.takenAt || "").localeCompare(a.takenAt || "") || a.sortOrder - b.sortOrder || b.id - a.id
          : a.sortOrder - b.sortOrder || b.id - a.id
      );
      const idx = sortedAll.findIndex((p) => p.id === qPhotoId);
      if (idx >= 0) setLightboxIdx(idx);
      router.replace("/gallery", { scroll: false });
      return;
    }

    setCategoryState(qCat);
    setCameraState(qCam);
    setLensState(qLens);
    if (qCam !== "all" || qLens !== "all") {
      setGearOpen(true);
      setGearTab(qLens !== "all" && qCam === "all" ? "lens" : "camera");
    }
  }, [photos, router, searchParams]);

  // Build Year/Month Optical Timeline entries
  const timelineEntries = useMemo(() => {
    const list: { ym: string; year: string; month: string; count: number; firstPhotoId: number; isYearStart: boolean }[] = [];
    const indexByYm = new Map<string, number>();
    let prevYear = "";
    for (const p of filtered) {
      const ym = (p.takenAt || "").slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(ym)) continue;
      const existing = indexByYm.get(ym);
      if (existing !== undefined) {
        list[existing].count += 1;
      } else {
        const [year, month] = ym.split("-");
        indexByYm.set(ym, list.length);
        list.push({
          ym,
          year,
          month,
          count: 1,
          firstPhotoId: p.id,
          isYearStart: year !== prevYear,
        });
        prevYear = year;
      }
    }
    return list;
  }, [filtered]);

  const [activeYm, setActiveYm] = useState<string>("");
  const [hoverYm, setHoverYm] = useState<string | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const rulerTrackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (timelineEntries.length === 0) return;
    let raf = 0;
    const syncActiveMonth = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 48) {
          setActiveYm(timelineEntries[timelineEntries.length - 1].ym);
          return;
        }
        const anchorY = window.innerHeight * 0.3;
        const nodes = galleryRef.current?.querySelectorAll<HTMLElement>("[data-ym]");
        if (!nodes || nodes.length === 0) return;
        let bestYm = timelineEntries[0].ym;
        let bestDist = Infinity;
        nodes.forEach((el) => {
          const rect = el.getBoundingClientRect();
          if (rect.height === 0) return;
          const dist = Math.abs(rect.top + rect.height * 0.35 - anchorY);
          if (dist < bestDist) {
            bestDist = dist;
            bestYm = el.dataset.ym || bestYm;
          }
        });
        setActiveYm(bestYm);
      });
    };
    syncActiveMonth();
    window.addEventListener("scroll", syncActiveMonth, { passive: true });
    window.addEventListener("resize", syncActiveMonth);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", syncActiveMonth);
      window.removeEventListener("resize", syncActiveMonth);
    };
  }, [timelineEntries, view]);

  const scrollToYm = useCallback((ym: string, instant = false) => {
    const entry = timelineEntries.find((e) => e.ym === ym);
    if (!entry) return;
    setActiveYm(ym);
    const el = galleryRef.current?.querySelector<HTMLElement>(`[data-photo-id="${entry.firstPhotoId}"]`);
    if (!el) return;
    const top = Math.max(0, window.scrollY + el.getBoundingClientRect().top - 110);
    window.scrollTo({ top, behavior: instant ? "auto" : "smooth" });
  }, [timelineEntries]);

  const pickYmAtClientY = useCallback((clientY: number) => {
    const track = rulerTrackRef.current;
    if (!track || timelineEntries.length === 0) return null;
    const rect = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(0.999, (clientY - rect.top) / Math.max(1, rect.height)));
    return timelineEntries[Math.floor(ratio * timelineEntries.length)]?.ym ?? null;
  }, [timelineEntries]);

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
    <div className="min-h-dvh flex flex-col">
      <SiteHeader
        photographerName={settings.photographerName}
        photographerNameEn={settings.photographerNameEn}
      />

      {/* Toolbar & Collapsible Gear Filter */}
      <div className="mx-auto w-full max-w-[1440px] px-4 py-3 sm:px-9 sm:py-4 border-b border-[var(--border)]">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          {/* Mobile Dedicated Row 1: Category Tabs */}
          <div className="flex w-full sm:w-auto items-center gap-4 sm:gap-5 overflow-x-auto no-scrollbar whitespace-nowrap border-b border-[var(--border)] pb-2 sm:border-b-0 sm:pb-0 text-sm sm:text-[15px]">
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

          {/* Mobile Row 2 / Desktop Right: Sort Switcher + Gear Filter + View Switcher */}
          <div className="flex w-full sm:w-auto shrink-0 items-center justify-between sm:justify-end gap-2 sm:gap-2.5">
            {/* Curated Default vs Chronological Time Sort Toggle */}
            <div
              role="group"
              aria-label={locale === "en" ? "Sort order" : "排序方式"}
              className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] p-0.5 text-xs"
            >
              <ArrowDownUp className="ml-1.5 mr-1 h-3.5 w-3.5 text-[var(--fg-subtle)] shrink-0" />
              <button
                type="button"
                onClick={() => changeSort("default")}
                className={`rounded px-2 py-1 transition cursor-pointer ${
                  sortBy === "default"
                    ? "bg-[var(--fg)] text-[var(--bg)] font-medium"
                    : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
                }`}
              >
                {locale === "en" ? "Curated" : "默认"}
              </button>
              <button
                type="button"
                onClick={() => changeSort("time")}
                className={`rounded px-2 py-1 transition cursor-pointer ${
                  sortBy === "time"
                    ? "bg-[var(--fg)] text-[var(--bg)] font-medium"
                    : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
                }`}
              >
                {locale === "en" ? "Latest" : "时间"}
              </button>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2.5">
              {hasActiveFilter && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 sm:px-2.5 py-1.5 text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] transition cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{locale === "en" ? "Reset" : "重置"}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setGearOpen((v) => !v)}
                className={`inline-flex items-center gap-1 sm:gap-1.5 rounded-md border px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm transition cursor-pointer ${
                  camera !== "all" || lens !== "all"
                    ? "border-[var(--fg)] bg-[var(--fg)] text-[var(--bg)] font-medium"
                    : "border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--fg)] hover:opacity-85"
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
                <span className="max-w-[108px] sm:max-w-none truncate">{filterButtonText}</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 shrink-0 transition-transform duration-250 ${
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
                <button
                  type="button"
                  onClick={() => changeView("sheet")}
                  aria-label={locale === "en" ? "Contact Sheet" : "接触印相表"}
                  title={locale === "en" ? "Contact Sheet" : "接触印相表"}
                  className={`p-2 transition-colors duration-200 cursor-pointer ${
                    view === "sheet"
                      ? "bg-[var(--fg)] text-[var(--bg)]"
                      : "bg-[var(--bg-elevated)] text-[var(--fg-muted)] hover:text-[var(--fg)]"
                  }`}
                >
                  <Grid3x3 className="h-4 w-4" />
                </button>
              </div>
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
            <div className="surface-card rounded-lg px-4 py-3 space-y-3">
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
                  <div className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-2.5">
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
                <div key="gear-lens" className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-2.5 animate-tab-in">
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
                        data-ym={(photo.takenAt || "").slice(0, 7)}
                        onClick={() => setLightboxIdx(flatIdx)}
                        style={{ "--item-grow": ratio } as React.CSSProperties}
                        className="group relative cursor-pointer will-change-transform hover:z-20 sm:[flex-basis:0%] sm:[flex-grow:var(--item-grow)]"
                      >
                        <GalleryImage
                          photoId={photo.id}
                          src={photo.url}
                          alt={title}
                          ambient={photo.ambient}
                          blurData={photo.blurData}
                          aspectRatio={`${photo.width || 1600} / ${photo.height || 1068}`}
                          className="w-full h-full"
                        />
                        <figcaption className="glass-strip pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm text-zinc-100 opacity-0 translate-y-1 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0">
                          <div className="min-w-0">
                            <div className="truncate font-medium">{title}</div>
                            {place && (
                              <div className="inline-flex items-center gap-1 truncate text-xs text-zinc-200">
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span className="truncate">{place.split(",")[0]}</span>
                              </div>
                            )}
                          </div>
                          <span className="inline-flex items-center gap-1 shrink-0 text-xs text-zinc-200">
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
        ) : view === "index" ? (
          /* View 2: Dense Span-Aware Bento Index */
          <main className="mx-auto max-w-[1440px] px-4 sm:px-9 pt-5 sm:pt-7">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 sm:auto-rows-[305px] grid-flow-dense">
              {filtered.map((photo, flatIdx) => {
                const isPortrait = (photo.height || 1068) > (photo.width || 1600) * 1.1;
                const title = pick(photo.title, photo.titleEn);
                const place = pick(photo.location, photo.locationEn);

                return (
                  <figure
                    key={photo.id}
                    data-photo-id={photo.id}
                    data-ym={(photo.takenAt || "").slice(0, 7)}
                    onClick={() => setLightboxIdx(flatIdx)}
                    className={`group relative flex flex-col cursor-pointer will-change-transform hover:z-20 ${
                      isPortrait ? "sm:row-span-2" : "sm:row-span-1"
                    }`}
                  >
                    <GalleryImage
                      photoId={photo.id}
                      src={photo.url}
                      alt={title}
                      ambient={photo.ambient}
                      blurData={photo.blurData}
                      style={{ "--mobile-ar": `${photo.width || 1600} / ${photo.height || 1068}` } as React.CSSProperties}
                      className="flex-1 [aspect-ratio:var(--mobile-ar)] sm:[aspect-ratio:auto] sm:min-h-0"
                    />
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
        ) : (
          /* View 3: Darkroom Contact Sheet (Uncropped Full-Frame Negatives + Frame Numbers) */
          <main className="mx-auto max-w-[1440px] px-4 sm:px-9 pt-5 sm:pt-7">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-x-3 gap-y-5 sm:gap-x-5 sm:gap-y-7">
              {filtered.map((photo, flatIdx) => {
                const title = pick(photo.title, photo.titleEn);
                return (
                  <figure
                    key={photo.id}
                    data-photo-id={photo.id}
                    data-ym={(photo.takenAt || "").slice(0, 7)}
                    onClick={() => setLightboxIdx(flatIdx)}
                    className="group flex flex-col cursor-pointer will-change-transform"
                  >
                    <div className="flex items-center justify-between pb-1.5 text-[10px] tracking-wider text-[var(--fg-subtle)]">
                      <span>#{String(flatIdx + 1).padStart(2, "0")}A</span>
                      <span>{photo.focalMm ? `${photo.focalMm}mm` : ""}</span>
                    </div>
                    <div className="aspect-square flex items-center justify-center rounded-xs border border-[var(--border)] bg-[var(--bg-subtle)] p-2 sm:p-2.5 group-hover:border-[var(--fg-muted)] transition-colors">
                      <img
                        data-morph-photo-id={photo.id}
                        src={photo.url}
                        alt={title}
                        className="max-h-full max-w-full object-contain transition-[scale,transform] duration-300 group-hover:scale-[1.04]"
                      />
                    </div>
                    <figcaption className="pt-1.5 truncate text-[11px] sm:text-xs text-[var(--fg-muted)] group-hover:text-[var(--fg)] transition-colors">
                      {title}
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          </main>
        )}
      </div>

      {/* Right-Edge Minimal Optical Timeline Scale (Chronological Time Sort) */}
      {sortBy === "time" && timelineEntries.length >= 2 && lightboxIdx === null && (
        <aside
          aria-label={locale === "en" ? "Timeline" : "拍摄时间刻度尺"}
          className="fixed right-2 sm:right-3 top-1/2 -translate-y-1/2 z-20 hidden md:flex items-center gap-2 select-none"
        >
          {(hoverYm || scrubbing) && (() => {
            const target = timelineEntries.find((e) => e.ym === (hoverYm || activeYm));
            if (!target) return null;
            return (
              <div className="pointer-events-none rounded border border-[var(--border)] bg-[var(--header-bg)] backdrop-blur-xl px-2.5 py-1 text-xs font-medium text-[var(--fg)] whitespace-nowrap animate-tab-in">
                <span>{target.year}.{target.month}</span>
                <span className="ml-1.5 text-[11px] text-[var(--fg-muted)]">
                  {locale === "en" ? `${target.count}` : `${target.count} 幅`}
                </span>
              </div>
            );
          })()}

          <div
            ref={rulerTrackRef}
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              setScrubbing(true);
              const ym = pickYmAtClientY(e.clientY);
              if (ym) {
                setHoverYm(ym);
                scrollToYm(ym, false);
              }
            }}
            onPointerMove={(e) => {
              const ym = pickYmAtClientY(e.clientY);
              setHoverYm(ym);
              if (scrubbing && ym && ym !== activeYm) {
                scrollToYm(ym, true);
              }
            }}
            onPointerUp={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
              }
              setScrubbing(false);
            }}
            onPointerCancel={() => setScrubbing(false)}
            onPointerLeave={() => {
              if (!scrubbing) setHoverYm(null);
            }}
            className="flex flex-col items-end gap-1.5 px-1.5 py-2 cursor-ns-resize touch-none"
          >
            {timelineEntries.map((entry) => {
              const isCurrent = (hoverYm || activeYm) === entry.ym;
              return (
                <div key={entry.ym} className="flex flex-col items-end gap-1">
                  {entry.isYearStart && (
                    <span
                      className={`text-[10px] leading-none tracking-wider font-medium transition-colors ${
                        isCurrent || activeYm.startsWith(entry.year)
                          ? "text-[var(--fg)]"
                          : "text-[var(--fg-subtle)]"
                      }`}
                    >
                      {entry.year}
                    </span>
                  )}
                  <div className="flex items-center py-0.5">
                    <span
                      className={`block rounded-full transition-all duration-200 ${
                        isCurrent
                          ? "h-[2px] w-4 bg-[var(--fg)]"
                          : entry.isYearStart
                          ? "h-[1.5px] w-2.5 bg-[var(--fg-muted)]/70"
                          : "h-[1.5px] w-1.5 bg-[var(--fg-subtle)]/50"
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      )}

      <SiteFooter settings={settings} />

      <Lightbox
        photos={filtered}
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
