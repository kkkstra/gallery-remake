"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Aperture, ArrowRight, Camera, CornerDownLeft, Layers, MapPin, Search, X } from "lucide-react";
import { usePreferences } from "./PreferencesProvider";

interface SearchPhoto {
  id: number;
  title: string;
  titleEn: string;
  url: string;
  ambient: string;
  category: string;
  location: string;
  locationEn: string;
  camera: string;
  lens: string;
  focalMm: number | null;
  aperture: string;
  takenAt: string;
}

interface SearchCollection {
  slug: string;
  title: string;
  titleEn: string;
  period: string;
  coverUrl: string;
  photoCount: number;
}

interface SearchIndexData {
  photos: SearchPhoto[];
  collections: SearchCollection[];
}

type ResultItem =
  | { kind: "photo"; key: string; photo: SearchPhoto }
  | { kind: "collection"; key: string; collection: SearchCollection }
  | { kind: "gear"; key: string; gearType: "camera" | "lens"; name: string; count: number };

let cachedIndex: SearchIndexData | null = null;

export function openCommandPalette() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("open-command-palette"));
  }
}

export function CommandPalette() {
  const router = useRouter();
  const { locale, pick, categoryLabel } = usePreferences();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [data, setData] = useState<SearchIndexData | null>(cachedIndex);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const ensureLoaded = useCallback(() => {
    if (cachedIndex) {
      setData(cachedIndex);
      return;
    }
    fetch("/api/search-index")
      .then((r) => r.json())
      .then((json: SearchIndexData) => {
        cachedIndex = json;
        setData(json);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    };
    const onOpenEvent = () => setOpen(true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("open-command-palette", onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("open-command-palette", onOpenEvent);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    ensureLoaded();
    setQuery("");
    setActiveIdx(0);
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [ensureLoaded, open]);

  const results = useMemo<ResultItem[]>(() => {
    if (!data) return [];
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

    if (tokens.length === 0) {
      const colItems: ResultItem[] = data.collections.map((c) => ({
        kind: "collection",
        key: `col-${c.slug}`,
        collection: c,
      }));
      const recentPhotos: ResultItem[] = data.photos.slice(0, 6).map((p) => ({
        kind: "photo",
        key: `photo-${p.id}`,
        photo: p,
      }));
      return [...colItems, ...recentPhotos];
    }

    const out: ResultItem[] = [];

    // 1. Gear matches (Cameras & Lenses)
    const camCounts = new Map<string, number>();
    const lensCounts = new Map<string, number>();
    for (const p of data.photos) {
      if (p.camera) camCounts.set(p.camera, (camCounts.get(p.camera) || 0) + 1);
      if (p.lens) lensCounts.set(p.lens, (lensCounts.get(p.lens) || 0) + 1);
    }
    for (const [name, count] of camCounts) {
      if (tokens.every((t) => name.toLowerCase().includes(t))) {
        out.push({ kind: "gear", key: `cam-${name}`, gearType: "camera", name, count });
      }
    }
    for (const [name, count] of lensCounts) {
      if (tokens.every((t) => name.toLowerCase().includes(t))) {
        out.push({ kind: "gear", key: `lens-${name}`, gearType: "lens", name, count });
      }
    }

    // 2. Collection matches
    for (const c of data.collections) {
      const hay = `${c.title} ${c.titleEn} ${c.period}`.toLowerCase();
      if (tokens.every((t) => hay.includes(t))) {
        out.push({ kind: "collection", key: `col-${c.slug}`, collection: c });
      }
    }

    // 3. Photo matches
    for (const p of data.photos) {
      const hay = [
        p.title,
        p.titleEn,
        p.location,
        p.locationEn,
        p.camera,
        p.lens,
        p.focalMm ? `${p.focalMm}mm` : "",
        p.aperture,
        p.takenAt,
        categoryLabel(p.category),
        p.category,
      ]
        .join(" ")
        .toLowerCase();
      if (tokens.every((t) => hay.includes(t))) {
        out.push({ kind: "photo", key: `photo-${p.id}`, photo: p });
      }
    }

    return out.slice(0, 14);
  }, [categoryLabel, data, query]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  const navigateTo = useCallback(
    (href: string) => {
      setOpen(false);
      const doc = document as Document & { startViewTransition?: (cb: () => void) => void };
      if (typeof doc.startViewTransition === "function" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        doc.startViewTransition(() => router.push(href));
      } else {
        router.push(href);
      }
    },
    [router]
  );

  const selectItem = useCallback(
    (item: ResultItem | undefined) => {
      if (!item) return;
      if (item.kind === "photo") {
        navigateTo(`/gallery?photo=${item.photo.id}`);
      } else if (item.kind === "collection") {
        navigateTo(`/collections/${item.collection.slug}`);
      } else {
        navigateTo(`/gallery?${item.gearType}=${encodeURIComponent(item.name)}`);
      }
    },
    [navigateTo]
  );

  if (!open) return null;

  const quickTags = locale === "en"
    ? ["Kyoto", "Iceland", "Dolomites", "Leica M11", "Hasselblad", "50mm"]
    : ["京都", "冰岛", "多洛米蒂", "Leica M11", "Hasselblad", "50mm"];

  return (
    <div
      onClick={() => setOpen(false)}
      className="fixed inset-0 z-[80] flex items-start justify-center bg-black/45 backdrop-blur-md px-3 pt-[6dvh] sm:px-4 sm:pt-[12dvh] animate-lightbox-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIdx((i) => (results.length ? (i + 1) % results.length : 0));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIdx((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            selectItem(results[activeIdx]);
          }
        }}
        className="surface-card w-full max-w-xl overflow-hidden rounded-2xl text-[var(--fg)] shadow-[0_28px_80px_rgba(0,0,0,0.55)]"
      >
        {/* Search Input Row */}
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3.5">
          <Search className="h-4.5 w-4.5 shrink-0 text-[var(--fg-muted)]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              locale === "en"
                ? "Search title, city, camera, lens, focal length..."
                : "搜索作品标题、城市、机身、镜头、焦段或年份…"
            }
            className="flex-1 bg-transparent text-base sm:text-[15px] text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-none"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="rounded-full p-1 text-[var(--fg-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg)] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <kbd className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[11px] text-[var(--fg-subtle)]">
              ESC
            </kbd>
          )}
        </div>

        {/* Quick Filter Chips when Empty */}
        {!query.trim() && (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--border)] px-4 py-2.5">
            {quickTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setQuery(tag)}
                className="rounded-full border border-[var(--border)] bg-[var(--bg-subtle)] px-2.5 py-0.5 text-xs text-[var(--fg-muted)] hover:border-[var(--fg-muted)] hover:text-[var(--fg)] transition cursor-pointer"
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* Results List */}
        <div className="max-h-[54dvh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="py-12 text-center text-sm text-[var(--fg-muted)]">
              {locale === "en" ? "No matching photos, series, or gear." : "未找到匹配的作品、影集或器材。"}
            </div>
          ) : (
            results.map((item, idx) => {
              const selected = idx === activeIdx;
              if (item.kind === "gear") {
                return (
                  <button
                    key={item.key}
                    type="button"
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => selectItem(item)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition cursor-pointer ${
                      selected ? "bg-[var(--bg-subtle)] text-[var(--fg)]" : "text-[var(--fg-muted)]"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)]">
                        {item.gearType === "camera" ? (
                          <Camera className="h-4 w-4 text-[var(--fg)]" />
                        ) : (
                          <Aperture className="h-4 w-4 text-[var(--fg)]" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-[var(--fg)]">{item.name}</div>
                        <div className="text-xs text-[var(--fg-subtle)]">
                          {locale === "en" ? `Filter by ${item.gearType} · ${item.count} photos` : `按器材筛选 · ${item.count} 幅作品`}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 opacity-60" />
                  </button>
                );
              }

              if (item.kind === "collection") {
                const c = item.collection;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => selectItem(item)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition cursor-pointer ${
                      selected ? "bg-[var(--bg-subtle)]" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="photo-frame h-9 w-13 shrink-0 overflow-hidden rounded-md bg-[var(--bg-subtle)]">
                        {c.coverUrl && <img src={c.coverUrl} alt="" className="h-full w-full object-cover" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-sm font-medium text-[var(--fg)]">
                          <Layers className="h-3.5 w-3.5 opacity-70" />
                          <span className="truncate">{pick(c.title, c.titleEn)}</span>
                        </div>
                        <div className="text-xs text-[var(--fg-muted)]">
                          {[c.period, `${c.photoCount} ${locale === "en" ? "photos" : "幅"}`].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-[var(--fg-muted)] opacity-60" />
                  </button>
                );
              }

              const p = item.photo;
              const pTitle = pick(p.title, p.titleEn);
              const pPlace = pick(p.location, p.locationEn);
              return (
                <button
                  key={item.key}
                  type="button"
                  onMouseEnter={() => setActiveIdx(idx)}
                  onClick={() => selectItem(item)}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition cursor-pointer ${
                    selected ? "bg-[var(--bg-subtle)]" : ""
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="photo-frame h-9 w-13 shrink-0 overflow-hidden rounded-md bg-[var(--bg-subtle)]">
                      <img src={p.url} alt="" className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-[var(--fg)]">{pTitle}</div>
                      <div className="flex items-center gap-2 truncate text-xs text-[var(--fg-muted)]">
                        {pPlace && (
                          <span className="inline-flex items-center gap-0.5 truncate">
                            <MapPin className="h-3 w-3 opacity-70" />
                            {pPlace.split(",")[0]}
                          </span>
                        )}
                        {p.camera && <span>· {p.camera}</span>}
                        {p.focalMm && <span>· {p.focalMm}mm</span>}
                      </div>
                    </div>
                  </div>
                  {selected && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-[var(--fg-muted)]" />}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
