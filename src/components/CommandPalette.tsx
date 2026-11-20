"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { optImg } from "@/lib/image-url";
import { usePreferences } from "./PreferencesProvider";

interface SearchPhoto {
  id: number;
  title: string;
  titleEn: string;
  url: string;
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
      return [
        ...data.collections.map((c): ResultItem => ({ kind: "collection", key: `col-${c.slug}`, collection: c })),
        ...data.photos.slice(0, 5).map((p): ResultItem => ({ kind: "photo", key: `photo-${p.id}`, photo: p })),
      ];
    }

    const out: ResultItem[] = [];
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
    for (const c of data.collections) {
      const hay = `${c.title} ${c.titleEn} ${c.period}`.toLowerCase();
      if (tokens.every((t) => hay.includes(t))) {
        out.push({ kind: "collection", key: `col-${c.slug}`, collection: c });
      }
    }
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
    return out.slice(0, 12);
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
      if (item.kind === "photo") navigateTo(`/gallery?photo=${item.photo.id}`);
      else if (item.kind === "collection") navigateTo(`/collections/${item.collection.slug}`);
      else navigateTo(`/gallery?${item.gearType}=${encodeURIComponent(item.name)}`);
    },
    [navigateTo]
  );

  if (!open) return null;

  return (
    <div
      onClick={() => setOpen(false)}
      className="fixed inset-0 z-[80] flex items-start justify-center bg-black/50 backdrop-blur-sm px-3 pt-[8dvh] sm:px-4 sm:pt-[14dvh] animate-lightbox-in"
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
        className="surface-card w-full max-w-lg overflow-hidden rounded-md text-[var(--fg)]"
      >
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-[var(--fg-muted)]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={locale === "en" ? "Search works, places, or gear…" : "搜索作品、地点或器材…"}
            className="flex-1 bg-transparent text-base sm:text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => (query ? setQuery("") : setOpen(false))}
            aria-label="关闭搜索"
            className="p-0.5 text-[var(--fg-muted)] hover:text-[var(--fg)] transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[52dvh] overflow-y-auto divide-y divide-[var(--border)]">
          {results.length === 0 ? (
            <div className="py-10 text-center text-xs text-[var(--fg-muted)]">
              {locale === "en" ? "No results" : "无匹配结果"}
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
                    className={`flex w-full items-center justify-between gap-4 px-4 py-2.5 text-left text-sm transition cursor-pointer ${
                      selected ? "bg-[var(--bg-subtle)]" : ""
                    }`}
                  >
                    <span className="truncate font-medium text-[var(--fg)]">{item.name}</span>
                    <span className="shrink-0 text-xs text-[var(--fg-subtle)]">
                      {locale === "en" ? `Gear · ${item.count}` : `器材 · ${item.count}`}
                    </span>
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
                    className={`flex w-full items-center justify-between gap-4 px-4 py-2.5 text-left text-sm transition cursor-pointer ${
                      selected ? "bg-[var(--bg-subtle)]" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {c.coverUrl && (
                        <img src={optImg(c.coverUrl, 96, 75)} decoding="async" alt="" className="h-7 w-10 shrink-0 rounded-[2px] object-cover" />
                      )}
                      <span className="truncate font-medium text-[var(--fg)]">
                        {pick(c.title, c.titleEn)}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs text-[var(--fg-subtle)]">
                      {locale === "en" ? `Series · ${c.photoCount}` : `影集 · ${c.photoCount}`}
                    </span>
                  </button>
                );
              }

              const p = item.photo;
              const pPlace = pick(p.location, p.locationEn);
              return (
                <button
                  key={item.key}
                  type="button"
                  onMouseEnter={() => setActiveIdx(idx)}
                  onClick={() => selectItem(item)}
                  className={`flex w-full items-center justify-between gap-4 px-4 py-2.5 text-left text-sm transition cursor-pointer ${
                    selected ? "bg-[var(--bg-subtle)]" : ""
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img src={optImg(p.url, 96, 75)} loading="lazy" decoding="async" alt="" className="h-7 w-10 shrink-0 rounded-[2px] object-cover" />
                    <span className="truncate font-medium text-[var(--fg)]">
                      {pick(p.title, p.titleEn)}
                    </span>
                  </div>
                  <span className="shrink-0 text-xs text-[var(--fg-subtle)]">
                    {[pPlace ? pPlace.split(",")[0] : "", p.focalMm ? `${p.focalMm}mm` : ""]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
