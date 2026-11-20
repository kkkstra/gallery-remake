"use client";

import { useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Images,
  Layers,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import type { Photo } from "@/lib/db/schema";
import type { CollectionWithPhotos } from "@/lib/queries";
import {
  parseOptionalIdList,
  resolveHomepageSections,
  serializeOptionalIdList,
} from "@/lib/homepage-config";
import { optImg } from "@/lib/image-url";
import { buildGroupMap, formatNumberedTitle } from "@/lib/photo-groups";

interface AdminHomepageTabProps {
  photos: Photo[];
  collections: CollectionWithPhotos[];
  settings: Record<string, string>;
  onSaved: (nextPatch: Record<string, string>, msg: string) => void;
}

function reorderAt<T>(arr: T[], from: number, to: number): T[] {
  if (from < 0 || to < 0 || from >= arr.length || to >= arr.length || from === to) return arr;
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function AdminHomepageTab({
  photos,
  collections,
  settings,
  onSaved,
}: AdminHomepageTabProps) {
  const publicPhotos = useMemo(() => photos.filter((p) => !p.hidden), [photos]);
  const photoMap = useMemo(() => new Map(publicPhotos.map((p) => [p.id, p])), [publicPhotos]);
  const groupMap = useMemo(() => buildGroupMap(publicPhotos), [publicPhotos]);

  const [featuredIds, setFeaturedIds] = useState<number[] | null>(() =>
    parseOptionalIdList(settings.homeFeaturedIds)
  );
  const [collectionIds, setCollectionIds] = useState<number[] | null>(() =>
    parseOptionalIdList(settings.homeCollectionIds)
  );
  const [galleryIds, setGalleryIds] = useState<number[] | null>(() =>
    parseOptionalIdList(settings.homeGalleryIds)
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<"featured" | "gallery" | null>(null);
  const [pickerQuery, setPickerQuery] = useState("");
  const dragRef = useRef<{ section: "featured" | "collections" | "gallery"; idx: number } | null>(
    null
  );

  const previewSettings = useMemo(
    () => ({
      ...settings,
      homeFeaturedIds: serializeOptionalIdList(featuredIds),
      homeCollectionIds: serializeOptionalIdList(collectionIds),
      homeGalleryIds: serializeOptionalIdList(galleryIds),
    }),
    [collectionIds, featuredIds, galleryIds, settings]
  );

  const resolved = useMemo(
    () => resolveHomepageSections(publicPhotos, collections, previewSettings),
    [collections, previewSettings, publicPhotos]
  );

  const activeFeaturedIds = featuredIds ?? resolved.heroSlides.map((p) => p.id);
  const activeCollectionIds = collectionIds ?? resolved.curatedCollections.map((c) => c.id);
  const activeGalleryIds = galleryIds ?? resolved.galleryCards.map((c) => c.photo.id);

  const mark = <T,>(setter: (v: T) => void, val: T) => {
    setter(val);
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch("/api/admin/homepage", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ featuredIds, collectionIds, galleryIds }),
    });
    setSaving(false);
    if (!res.ok) return;
    setDirty(false);
    onSaved(
      {
        homeFeaturedIds: serializeOptionalIdList(featuredIds),
        homeCollectionIds: serializeOptionalIdList(collectionIds),
        homeGalleryIds: serializeOptionalIdList(galleryIds),
      },
      "首页精选、影集与相册编排已保存生效"
    );
  };

  const pickerCandidates = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    return publicPhotos.filter((p) => {
      if (!q) return true;
      return `${p.title} ${p.titleEn} ${p.location} ${p.camera} ${p.lens}`
        .toLowerCase()
        .includes(q);
    });
  }, [pickerQuery, publicPhotos]);

  const renderPhotoStrip = (
    section: "featured" | "gallery",
    ids: number[],
    onChangeIds: (next: number[]) => void,
    emptyHint: string
  ) => {
    if (ids.length === 0) {
      return (
        <div className="rounded-lg border border-dashed border-[var(--border)] py-8 text-center text-xs text-[var(--fg-muted)]">
          {emptyHint}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
        {ids.map((id, idx) => {
          const p = photoMap.get(id);
          if (!p) return null;
          const gInfo = groupMap.get(p.id);
          const label =
            section === "gallery" && gInfo
              ? p.title
              : formatNumberedTitle(p.title, gInfo);
          return (
            <div
              key={p.id}
              draggable
              onDragStart={() => {
                dragRef.current = { section, idx };
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                const cur = dragRef.current;
                dragRef.current = null;
                if (!cur || cur.section !== section) return;
                onChangeIds(reorderAt(ids, cur.idx, idx));
              }}
              className="group relative overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] cursor-grab"
            >
              <div className="relative aspect-[3/2] overflow-hidden">
                <img
                  src={optImg(p.url, 384, 75)}
                  loading="lazy"
                  decoding="async"
                  alt={label}
                  className="h-full w-full object-cover"
                />
                <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  #{idx + 1}
                </span>
                {gInfo && (
                  <span className="absolute left-1.5 bottom-1.5 inline-flex items-center gap-0.5 rounded bg-black/65 px-1.5 py-0.5 text-[10px] text-white">
                    <Layers className="h-2.5 w-2.5" />
                    {section === "gallery" ? `组图 ${gInfo.total}` : `${gInfo.index}/${gInfo.total}`}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onChangeIds(ids.filter((x) => x !== p.id))}
                  title="从该区块移除"
                  className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/65 text-white/85 hover:bg-rose-500 hover:text-white transition cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>

              <div className="flex items-center justify-between gap-1 px-2 py-1.5 text-[11px]">
                <span className="truncate font-medium text-[var(--fg)]">{label}</span>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => onChangeIds(reorderAt(ids, idx, idx - 1))}
                    className="rounded p-0.5 text-[var(--fg-muted)] hover:text-[var(--fg)] disabled:opacity-25 cursor-pointer"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === ids.length - 1}
                    onClick={() => onChangeIds(reorderAt(ids, idx, idx + 1))}
                    className="rounded p-0.5 text-[var(--fg-muted)] hover:text-[var(--fg)] disabled:opacity-25 cursor-pointer"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const pickerSelectedList =
    pickerTarget === "featured" ? activeFeaturedIds : activeGalleryIds;

  const togglePickerPhoto = (id: number) => {
    if (!pickerTarget) return;
    const base = pickerTarget === "featured" ? activeFeaturedIds : activeGalleryIds;
    const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    if (pickerTarget === "featured") mark(setFeaturedIds, next);
    else mark(setGalleryIds, next);
  };

  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pt-6 pb-24 sm:px-7 space-y-6 text-xs">
      {/* Header Bar */}
      <section className="surface-card flex flex-wrap items-center justify-between gap-4 rounded-xl p-5">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-[var(--fg)]">
            首页展示内容与顺序编排
          </h2>
          <p className="text-[var(--fg-muted)]">
            自由挑选首页「全屏精选轮播」「专题影集」「相册预览墙」展示哪些内容，支持拖拽卡片或点击左右箭头调整精确顺序。
          </p>
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className={`rounded-md px-5 py-2 font-medium transition cursor-pointer ${
            dirty
              ? "bg-emerald-500 text-white shadow-md"
              : "bg-[var(--fg)] text-[var(--bg)] hover:opacity-90"
          }`}
        >
          {saving ? "保存中…" : dirty ? "保存首页编排更改" : "保存首页编排"}
        </button>
      </section>

      {/* 1. Hero Featured Carousel */}
      <section className="surface-card rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 opacity-80" />
              <h3 className="text-sm font-semibold text-[var(--fg)]">
                第一屏 · 首页精选大图轮播 ({activeFeaturedIds.length})
              </h3>
              <span className="rounded-full border border-[var(--border)] bg-[var(--bg-subtle)] px-2 py-0.5 text-[10px] text-[var(--fg-muted)]">
                {featuredIds === null ? "自动跟随 ★ 精选标记" : "自定义列表与顺序"}
              </span>
            </div>
            <p className="text-[var(--fg-muted)]">
              决定打开网站第一眼看到哪些轮播大图及播放先后顺序（#1 为首屏第一张）。
            </p>
          </div>

          <div className="flex items-center gap-2">
            {featuredIds !== null && (
              <button
                type="button"
                onClick={() => mark(setFeaturedIds, null)}
                className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[var(--fg-muted)] hover:text-[var(--fg)] cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" /> 恢复自动精选
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setPickerQuery("");
                setPickerTarget("featured");
              }}
              className="inline-flex items-center gap-1 rounded-md bg-[var(--fg)] px-3 py-1.5 font-medium text-[var(--bg)] hover:opacity-90 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> 选择轮播作品
            </button>
          </div>
        </div>

        {renderPhotoStrip(
          "featured",
          activeFeaturedIds,
          (next) => mark(setFeaturedIds, next),
          "尚未选择轮播作品，点击右上角「选择轮播作品」或恢复自动精选。"
        )}
      </section>

      {/* 2. Homepage Curated Collections */}
      <section className="surface-card rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 opacity-80" />
              <h3 className="text-sm font-semibold text-[var(--fg)]">
                第二屏 · 首页影集展示 ({activeCollectionIds.length} / {collections.length})
              </h3>
              <span className="rounded-full border border-[var(--border)] bg-[var(--bg-subtle)] px-2 py-0.5 text-[10px] text-[var(--fg-muted)]">
                {collectionIds === null ? "默认展示全部影集" : "自定义展示与顺序"}
              </span>
            </div>
            <p className="text-[var(--fg-muted)]">
              选择哪些影集出现在首页及排列顺序；若全部移出则首页自动隐藏「影集」板块（不影响 /collections 影集页）。
            </p>
          </div>

          <div className="flex items-center gap-2">
            {collectionIds !== null && (
              <button
                type="button"
                onClick={() => mark(setCollectionIds, null)}
                className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[var(--fg-muted)] hover:text-[var(--fg)] cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" /> 恢复全部影集
              </button>
            )}
            {activeCollectionIds.length > 0 && (
              <button
                type="button"
                onClick={() => mark(setCollectionIds, [])}
                className="rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[var(--fg-muted)] hover:text-[var(--fg)] cursor-pointer"
              >
                首页隐藏影集区
              </button>
            )}
          </div>
        </div>

        {activeCollectionIds.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--border)] py-7 text-center text-[var(--fg-muted)]">
            当前已在首页隐藏「影集」板块；点击下方影集标签即可加入首页展示。
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {activeCollectionIds.map((cid, idx) => {
              const col = collections.find((c) => c.id === cid);
              if (!col) return null;
              return (
                <div
                  key={col.id}
                  draggable
                  onDragStart={() => {
                    dragRef.current = { section: "collections", idx };
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    const cur = dragRef.current;
                    dragRef.current = null;
                    if (!cur || cur.section !== "collections") return;
                    mark(setCollectionIds, reorderAt(activeCollectionIds, cur.idx, idx));
                  }}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-2.5 cursor-grab"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative h-12 w-18 shrink-0 overflow-hidden rounded-xs bg-[var(--bg)]">
                      {col.coverUrl && (
                        <img
                          src={optImg(col.coverUrl, 256, 75)}
                          loading="lazy"
                          decoding="async"
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      )}
                      <span className="absolute left-1 top-1 rounded bg-black/70 px-1 text-[10px] font-semibold text-white">
                        #{idx + 1}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-[var(--fg)]">{col.title}</div>
                      <div className="text-[11px] text-[var(--fg-muted)]">
                        {[col.period, `${col.photoCount} 幅`].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() =>
                        mark(setCollectionIds, reorderAt(activeCollectionIds, idx, idx - 1))
                      }
                      className="rounded border border-[var(--border)] p-1 text-[var(--fg-muted)] hover:text-[var(--fg)] disabled:opacity-25 cursor-pointer"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === activeCollectionIds.length - 1}
                      onClick={() =>
                        mark(setCollectionIds, reorderAt(activeCollectionIds, idx, idx + 1))
                      }
                      className="rounded border border-[var(--border)] p-1 text-[var(--fg-muted)] hover:text-[var(--fg)] disabled:opacity-25 cursor-pointer"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        mark(
                          setCollectionIds,
                          activeCollectionIds.filter((x) => x !== col.id)
                        )
                      }
                      title="从首页移除"
                      className="rounded border border-[var(--border)] p-1 text-[var(--fg-muted)] hover:text-rose-400 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Unselected collections quick-add chips */}
        {collections.some((c) => !activeCollectionIds.includes(c.id)) && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[var(--fg-muted)]">点击加入首页：</span>
            {collections
              .filter((c) => !activeCollectionIds.includes(c.id))
              .map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => mark(setCollectionIds, [...activeCollectionIds, c.id])}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 py-1 text-[var(--fg)] hover:border-[var(--fg-muted)] cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  <span>{c.title}</span>
                </button>
              ))}
          </div>
        )}
      </section>

      {/* 3. Homepage Gallery Mosaic */}
      <section className="surface-card rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Images className="h-4 w-4 opacity-80" />
              <h3 className="text-sm font-semibold text-[var(--fg)]">
                第三屏 · 首页相册预览墙 ({activeGalleryIds.length})
              </h3>
              <span className="rounded-full border border-[var(--border)] bg-[var(--bg-subtle)] px-2 py-0.5 text-[10px] text-[var(--fg-muted)]">
                {galleryIds === null ? "默认展示前 8 幅" : "自定义作品与顺序"}
              </span>
            </div>
            <p className="text-[var(--fg-muted)]">
              自定义首页底部「相册」区域展示哪些代表作或组图及排列顺序（组图选择封面张即自动以叠卡展示）。
            </p>
          </div>

          <div className="flex items-center gap-2">
            {galleryIds !== null && (
              <button
                type="button"
                onClick={() => mark(setGalleryIds, null)}
                className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[var(--fg-muted)] hover:text-[var(--fg)] cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" /> 恢复默认前 8 幅
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setPickerQuery("");
                setPickerTarget("gallery");
              }}
              className="inline-flex items-center gap-1 rounded-md bg-[var(--fg)] px-3 py-1.5 font-medium text-[var(--bg)] hover:opacity-90 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> 选择相册作品
            </button>
          </div>
        </div>

        {renderPhotoStrip(
          "gallery",
          activeGalleryIds,
          (next) => mark(setGalleryIds, next),
          "当前已在首页隐藏「相册」板块；点击右上角「选择相册作品」或恢复默认。"
        )}
      </section>

      {/* Modal Photo Picker for Featured / Homepage Gallery */}
      {pickerTarget && (
        <div
          onClick={() => setPickerTarget(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="surface-card flex max-h-[84dvh] w-full max-w-4xl flex-col rounded-2xl p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
              <div>
                <h3 className="text-sm font-semibold text-[var(--fg)]">
                  {pickerTarget === "featured"
                    ? "选择首页全屏轮播作品（按点选先后加入末尾）"
                    : "选择首页相册预览墙作品（按点选先后加入末尾）"}
                </h3>
                <p className="text-[var(--fg-muted)]">
                  已选 {pickerSelectedList.length} 幅 · 再次点击已选卡片可取消选择
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPickerTarget(null)}
                className="rounded-full p-1 text-[var(--fg-muted)] hover:text-[var(--fg)] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--fg-subtle)]" />
              <input
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                placeholder="搜索标题、拍摄地、机身或镜头…"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-subtle)] pl-8 pr-3 py-1.5 text-xs text-[var(--fg)] outline-none focus:border-[var(--fg-muted)]"
              />
            </div>

            <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 pr-1">
              {pickerCandidates.map((p) => {
                const orderIdx = pickerSelectedList.indexOf(p.id);
                const selected = orderIdx >= 0;
                const gInfo = groupMap.get(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePickerPhoto(p.id)}
                    className={`group relative overflow-hidden rounded-lg border text-left transition cursor-pointer ${
                      selected
                        ? "border-[var(--fg)] ring-2 ring-[var(--fg)]"
                        : "border-[var(--border)] opacity-80 hover:opacity-100"
                    }`}
                  >
                    <div className="relative aspect-[3/2] bg-[var(--bg-subtle)]">
                      <img
                        src={optImg(p.url, 384, 75)}
                        loading="lazy"
                        decoding="async"
                        alt=""
                        className="h-full w-full object-cover"
                      />
                      {selected && (
                        <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          <Check className="h-2.5 w-2.5" /> #{orderIdx + 1}
                        </span>
                      )}
                      {gInfo && (
                        <span className="absolute left-1.5 bottom-1.5 inline-flex items-center gap-0.5 rounded bg-black/65 px-1.5 py-0.5 text-[10px] text-white">
                          <Layers className="h-2.5 w-2.5" /> {gInfo.index}/{gInfo.total}
                        </span>
                      )}
                    </div>
                    <div className="p-2">
                      <div className="truncate font-medium text-[var(--fg)]">
                        {formatNumberedTitle(p.title, gInfo)}
                      </div>
                      <div className="truncate text-[10px] text-[var(--fg-muted)]">
                        {p.location || p.camera || "—"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end border-t border-[var(--border)] pt-3">
              <button
                type="button"
                onClick={() => setPickerTarget(null)}
                className="rounded-md bg-[var(--fg)] px-5 py-1.5 font-medium text-[var(--bg)] cursor-pointer"
              >
                完成选择
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
