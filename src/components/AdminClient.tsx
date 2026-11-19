"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Check,
  ExternalLink,
  GripVertical,
  LogOut,
  MapPin,
  Pencil,
  Plus,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { GearItem, Photo } from "@/lib/db/schema";
import type { CollectionWithPhotos } from "@/lib/queries";
import {
  parseMonographBlocks,
  type CoverStyle,
  type MonographBlock,
  type MonographCoverBlock,
} from "@/lib/monograph";
import type { AboutFocusItem, AboutMilestoneItem } from "./AboutClient";

interface AdminClientProps {
  authenticated: boolean;
  storageMode: "local" | "s3";
  initialPhotos: Photo[];
  initialCollections: CollectionWithPhotos[];
  initialGear: (GearItem & { photoCount: number })[];
  initialSettings: Record<string, string>;
}

async function analyzeImageFile(file: File): Promise<{ width: number; height: number; ambient: string }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth || 1600;
      const height = img.naturalHeight || 1068;
      let ambient = "#1e2024";
      try {
        const c = document.createElement("canvas");
        c.width = 16;
        c.height = 16;
        const ctx = c.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, 16, 16);
          const { data } = ctx.getImageData(0, 0, 16, 16);
          let r = 0, g = 0, b = 0, n = 0;
          for (let i = 0; i < data.length; i += 4) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            n++;
          }
          const dr = Math.round((r / n) * 0.28);
          const dg = Math.round((g / n) * 0.28);
          const db = Math.round((b / n) * 0.28);
          ambient = `#${[dr, dg, db].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
        }
      } catch {
        // ignore
      }
      URL.revokeObjectURL(url);
      resolve({ width, height, ambient });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ width: 1600, height: 1068, ambient: "#1e2024" });
    };
    img.src = url;
  });
}

function safeParseArray<T>(raw: string | undefined, fallback: T[] = []): T[] {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function AdminClient({
  authenticated,
  storageMode,
  initialPhotos,
  initialCollections,
  initialGear,
  initialSettings,
}: AdminClientProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [tab, setTab] = useState<"photos" | "collections" | "gear" | "settings">("photos");
  const [toast, setToast] = useState("");

  // Local sortable photo state + multi-select batch state
  const [photoList, setPhotoList] = useState<Photo[]>(initialPhotos);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const dragPhotoIdxRef = useRef<number | null>(null);

  useEffect(() => {
    setPhotoList(initialPhotos);
  }, [initialPhotos]);

  // Upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [batchCategory, setBatchCategory] = useState("landscape");
  const [batchFeatured, setBatchFeatured] = useState(true);
  const [batchColId, setBatchColId] = useState("0");
  const [showExternalForm, setShowExternalForm] = useState(false);
  const [extPhoto, setExtPhoto] = useState({
    title: "",
    url: "",
    category: "landscape",
    location: "",
    locationEn: "",
    lat: "" as string | number,
    lng: "" as string | number,
  });

  // Edit Photo modal
  const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null);
  const [editingColIds, setEditingColIds] = useState<number[]>([]);
  const [geocoding, setGeocoding] = useState(false);

  // Collection + Monograph Sequencer form
  const [editingCol, setEditingCol] = useState<{
    id?: number;
    slug: string;
    title: string;
    titleEn: string;
    period: string;
    coverUrl: string;
    description: string;
    descriptionEn: string;
    blocks: MonographBlock[];
  } | null>(null);
  const dragBlockIdxRef = useRef<number | null>(null);

  // Gear form
  const [newGear, setNewGear] = useState({
    type: "camera",
    brand: "",
    name: "",
    specs: "",
    note: "",
    noteEn: "",
  });

  // Settings + structured About editors
  const [settingsForm, setSettingsForm] = useState<Record<string, string>>(initialSettings);
  const [focusList, setFocusList] = useState<AboutFocusItem[]>(() =>
    safeParseArray<AboutFocusItem>(initialSettings.aboutFocusJson)
  );
  const [milestoneList, setMilestoneList] = useState<AboutMilestoneItem[]>(() =>
    safeParseArray<AboutMilestoneItem>(initialSettings.aboutMilestonesJson)
  );

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2600);
  };

  if (!authenticated) {
    const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoginErr("");
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setLoginErr(data.error || "登录失败");
        return;
      }
      router.refresh();
    };

    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#0B0B0D] px-5 text-zinc-200">
        <form onSubmit={handleLogin} className="w-full max-w-sm space-y-5 border border-white/10 bg-[#121317] p-7">
          <div className="space-y-1">
            <h1 className="text-lg font-medium text-white">管理工作台登录</h1>
            <p className="text-xs text-zinc-500">输入管理口令进入作品与影集管理（默认口令可通过环境变量 ADMIN_PASSWORD 配置）</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="admin-pw" className="block text-xs text-zinc-400">
              管理口令
            </label>
            <input
              id="admin-pw"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="输入口令"
              className="w-full border border-white/15 bg-[#0B0B0D] px-3 py-2 text-base sm:text-sm text-white outline-none focus:border-white/50"
            />
            {loginErr && <p className="text-xs text-red-400">{loginErr}</p>}
          </div>

          <div className="flex items-center justify-between pt-1">
            <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300">
              ← 返回前台
            </Link>
            <button
              type="submit"
              className="bg-white px-4 py-2 text-xs font-medium text-zinc-950 hover:bg-zinc-200 transition cursor-pointer"
            >
              进入后台
            </button>
          </div>
        </form>
      </div>
    );
  }

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.refresh();
  };

  const handleFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (arr.length === 0) return;
    setUploading(true);
    let done = 0;
    for (const file of arr) {
      done += 1;
      setUploadProgress(`正在解析 EXIF 并上传 (${done}/${arr.length})：${file.name}`);
      const meta = await analyzeImageFile(file);
      const fd = new FormData();
      fd.append("file", file);
      fd.append("width", String(meta.width));
      fd.append("height", String(meta.height));
      fd.append("ambient", meta.ambient);
      fd.append("category", batchCategory);
      fd.append("featured", String(batchFeatured));
      if (Number(batchColId) > 0) fd.append("collectionId", batchColId);

      await fetch("/api/admin/upload", { method: "POST", body: fd });
    }
    setUploading(false);
    setUploadProgress("");
    notify(`已上传 ${arr.length} 幅作品`);
    router.refresh();
  };

  const resolveCityGeocode = async (
    query: string,
    onResolved: (res: { lat: number; lng: number; location: string; locationEn: string }) => void
  ) => {
    if (!query.trim()) {
      notify("请先输入城市或拍摄地名称");
      return;
    }
    setGeocoding(true);
    try {
      const r = await fetch(`/api/admin/geocode?q=${encodeURIComponent(query.trim())}`);
      const data = await r.json();
      if (!r.ok) {
        notify(data.error || "未能识别坐标");
      } else {
        onResolved(data);
        notify(`已解析坐标：${data.lat}, ${data.lng}`);
      }
    } catch {
      notify("坐标解析失败");
    } finally {
      setGeocoding(false);
    }
  };

  const handleAddExternal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extPhoto.url || !extPhoto.title) return;
    const res = await fetch("/api/admin/photos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...extPhoto,
        featured: batchFeatured,
        collectionIds: Number(batchColId) > 0 ? [Number(batchColId)] : [],
      }),
    });
    if (res.ok) {
      setExtPhoto({ title: "", url: "", category: "landscape", location: "", locationEn: "", lat: "", lng: "" });
      setShowExternalForm(false);
      notify("已添加外链作品");
      router.refresh();
    }
  };

  const persistPhotoOrder = async (nextList: Photo[]) => {
    setPhotoList(nextList);
    await fetch("/api/admin/photos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: nextList.map((p) => p.id) }),
    });
    notify("已保存排序");
    router.refresh();
  };

  const movePhoto = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= photoList.length) return;
    const next = [...photoList];
    [next[idx], next[target]] = [next[target], next[idx]];
    await persistPhotoOrder(next);
  };

  const runBatchAction = async (action: "category" | "featured" | "collection" | "delete", value?: string | boolean | number) => {
    if (selectedIds.length === 0) return;
    if (action === "delete" && !confirm(`确认删除选中的 ${selectedIds.length} 幅作品？`)) return;
    const res = await fetch("/api/admin/photos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds, action, value }),
    });
    if (res.ok) {
      if (action === "delete") setSelectedIds([]);
      notify(`已批量更新 ${selectedIds.length} 幅作品`);
      router.refresh();
    }
  };

  const toggleFeatured = async (photo: Photo) => {
    await fetch(`/api/admin/photos/${photo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ featured: !photo.featured }),
    });
    router.refresh();
  };

  const deletePhoto = async (photo: Photo) => {
    if (!confirm(`确认删除《${photo.title}》？`)) return;
    await fetch(`/api/admin/photos/${photo.id}`, { method: "DELETE" });
    setSelectedIds((prev) => prev.filter((id) => id !== photo.id));
    notify("已删除作品");
    router.refresh();
  };

  const openEditModal = (photo: Photo) => {
    setEditingPhoto({ ...photo });
    const memberCols = initialCollections
      .filter((c) => c.photos.some((p) => p.id === photo.id))
      .map((c) => c.id);
    setEditingColIds(memberCols);
  };

  const saveEditedPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPhoto) return;
    await fetch(`/api/admin/photos/${editingPhoto.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...editingPhoto, collectionIds: editingColIds }),
    });
    setEditingPhoto(null);
    notify("已保存作品信息");
    router.refresh();
  };

  // Collection & Monograph Sequencer helpers
  const openCollectionEditor = (col?: CollectionWithPhotos) => {
    if (!col) {
      const defaultCover: MonographCoverBlock = {
        id: `cov-${Date.now()}`,
        kind: "cover",
        style: "full",
        imageUrl: photoList[0]?.url || "",
        eyebrow: "2026",
        eyebrowEn: "2026",
        title: "",
        titleEn: "",
        body: "",
        bodyEn: "",
      };
      setEditingCol({
        slug: "",
        title: "",
        titleEn: "",
        period: "2026",
        coverUrl: photoList[0]?.url || "",
        description: "",
        descriptionEn: "",
        blocks: [defaultCover],
      });
      return;
    }

    setEditingCol({
      id: col.id,
      slug: col.slug,
      title: col.title,
      titleEn: col.titleEn,
      period: col.period,
      coverUrl: col.coverUrl,
      description: col.description,
      descriptionEn: col.descriptionEn,
      blocks: parseMonographBlocks(col.blocksJson, col),
    });
  };

  const togglePhotoInMonograph = (photoId: number) => {
    if (!editingCol) return;
    const exists = editingCol.blocks.some((b) => b.kind === "photo" && b.photoId === photoId);
    const nextBlocks = exists
      ? editingCol.blocks.filter((b) => !(b.kind === "photo" && b.photoId === photoId))
      : [
          ...editingCol.blocks,
          {
            id: `ph-${photoId}-${Date.now()}`,
            kind: "photo" as const,
            photoId,
            sideNote: "",
            sideNoteEn: "",
            noteAlign: "right" as const,
          },
        ];
    setEditingCol({ ...editingCol, blocks: nextBlocks });
  };

  const addCoverBlock = () => {
    if (!editingCol) return;
    const covCount = editingCol.blocks.filter((b) => b.kind === "cover").length;
    const romans = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
    const chLabel = covCount === 0 ? editingCol.period : `CHAPTER ${romans[covCount - 1] || covCount}`;
    const newBlock: MonographCoverBlock = {
      id: `cov-${Date.now()}`,
      kind: "cover",
      style: covCount === 0 ? "full" : covCount === 1 ? "minimal" : "split",
      imageUrl: covCount === 1 ? "" : editingCol.coverUrl || photoList[0]?.url || "",
      eyebrow: chLabel,
      eyebrowEn: chLabel,
      title: covCount === 0 ? editingCol.title : "",
      titleEn: covCount === 0 ? editingCol.titleEn : "",
      body: "",
      bodyEn: "",
    };
    setEditingCol({ ...editingCol, blocks: [...editingCol.blocks, newBlock] });
  };

  const updateBlockAt = (idx: number, patch: Partial<MonographBlock>) => {
    if (!editingCol) return;
    const next = editingCol.blocks.map((b, i) => (i === idx ? ({ ...b, ...patch } as MonographBlock) : b));
    setEditingCol({ ...editingCol, blocks: next });
  };

  const moveBlock = (idx: number, dir: -1 | 1) => {
    if (!editingCol) return;
    const target = idx + dir;
    if (target < 0 || target >= editingCol.blocks.length) return;
    const next = [...editingCol.blocks];
    [next[idx], next[target]] = [next[target], next[idx]];
    setEditingCol({ ...editingCol, blocks: next });
  };

  const removeBlockAt = (idx: number) => {
    if (!editingCol) return;
    setEditingCol({
      ...editingCol,
      blocks: editingCol.blocks.filter((_, i) => i !== idx),
    });
  };

  const saveCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCol) return;

    const orderedPhotoIds = editingCol.blocks
      .filter((b): b is Extract<MonographBlock, { kind: "photo" }> => b.kind === "photo")
      .map((b) => b.photoId);

    // Sync first cover fallback if title was left blank on opening cover
    const normalizedBlocks = editingCol.blocks.map((b, idx) => {
      if (b.kind === "cover" && idx === 0) {
        return {
          ...b,
          title: b.title || editingCol.title,
          titleEn: b.titleEn || editingCol.titleEn,
          body: b.body || editingCol.description,
          bodyEn: b.bodyEn || editingCol.descriptionEn,
          imageUrl: b.imageUrl || editingCol.coverUrl,
        };
      }
      return b;
    });

    const url = editingCol.id ? `/api/admin/collections/${editingCol.id}` : "/api/admin/collections";
    const method = editingCol.id ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: editingCol.slug,
        title: editingCol.title,
        titleEn: editingCol.titleEn,
        period: editingCol.period,
        coverUrl: editingCol.coverUrl,
        description: editingCol.description,
        descriptionEn: editingCol.descriptionEn,
        photoIds: orderedPhotoIds,
        blocksJson: JSON.stringify(normalizedBlocks),
      }),
    });
    if (res.ok) {
      setEditingCol(null);
      notify("影集与画册编排已保存");
      router.refresh();
    }
  };

  const deleteCollection = async (id: number, title: string) => {
    if (!confirm(`确认删除专题影集《${title}》？（不会删除原照片）`)) return;
    await fetch(`/api/admin/collections/${id}`, { method: "DELETE" });
    notify("已删除影集");
    router.refresh();
  };

  const addGearItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGear.name.trim()) return;
    await fetch("/api/admin/gear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newGear),
    });
    setNewGear({ type: newGear.type, brand: "", name: "", specs: "", note: "", noteEn: "" });
    notify("已添加器材");
    router.refresh();
  };

  const removeGearItem = async (id: number) => {
    await fetch(`/api/admin/gear?id=${id}`, { method: "DELETE" });
    notify("已移除器材");
    router.refresh();
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...settingsForm,
      aboutFocusJson: JSON.stringify(focusList),
      aboutMilestonesJson: JSON.stringify(milestoneList),
    };
    await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    notify("全部站点与关于页配置已保存");
    router.refresh();
  };

  const photoMap = new Map(photoList.map((p) => [p.id, p]));

  return (
    <div className="min-h-dvh bg-[#0B0B0D] text-zinc-200 pb-24">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0B0B0D]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 text-sm">
          <div className="flex flex-wrap items-center gap-4 sm:gap-7">
            <span className="text-base font-medium text-white">摄影站管理台</span>
            <nav className="flex items-center gap-4 sm:gap-5 overflow-x-auto no-scrollbar">
              {(
                [
                  ["photos", `作品管理 (${photoList.length})`],
                  ["collections", `专题影集 (${initialCollections.length})`],
                  ["gear", `器材档案 (${initialGear.length})`],
                  ["settings", "站点与关于配置"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTab(k)}
                  className={`whitespace-nowrap pb-0.5 transition cursor-pointer ${
                    tab === k ? "text-white border-b border-white font-medium" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-4 text-xs sm:text-sm text-zinc-400">
            <span className="hidden sm:inline text-[11px]">
              存储: {storageMode === "s3" ? "S3 对象存储" : "本地 data/uploads"}
            </span>
            <Link href="/" target="_blank" className="inline-flex items-center gap-1 hover:text-white">
              查看前台 <ExternalLink className="h-3 w-3" />
            </Link>
            <button type="button" onClick={handleLogout} className="inline-flex items-center gap-1 hover:text-white cursor-pointer">
              <LogOut className="h-3.5 w-3.5" /> 退出
            </button>
          </div>
        </div>
      </header>

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 border border-white/20 bg-zinc-900 px-4 py-2.5 text-xs text-white shadow-xl">
          <Check className="h-3.5 w-3.5 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 sm:px-5 pt-7 space-y-7">
        {/* TAB 1: PHOTOS & UPLOAD */}
        {tab === "photos" && (
          <>
            {/* Batch Upload Zone */}
            <section className="border border-white/10 bg-[#121317] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-zinc-400">
                    默认分类
                    <select
                      value={batchCategory}
                      onChange={(e) => setBatchCategory(e.target.value)}
                      className="border border-white/15 bg-[#0B0B0D] px-2 py-1 text-zinc-200"
                    >
                      <option value="landscape">自然风光</option>
                      <option value="street">城市人文</option>
                      <option value="architecture">建筑空间</option>
                      <option value="portrait">人像纪实</option>
                      <option value="still">静物日常</option>
                    </select>
                  </label>

                  <label className="flex items-center gap-2 text-zinc-400">
                    加入影集
                    <select
                      value={batchColId}
                      onChange={(e) => setBatchColId(e.target.value)}
                      className="border border-white/15 bg-[#0B0B0D] px-2 py-1 text-zinc-200"
                    >
                      <option value="0">不指定</option>
                      {initialCollections.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex items-center gap-1.5 text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={batchFeatured}
                      onChange={(e) => setBatchFeatured(e.target.checked)}
                    />
                    设为首页精选
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => setShowExternalForm((v) => !v)}
                  className="inline-flex items-center gap-1 text-zinc-300 hover:text-white underline underline-offset-4 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {showExternalForm ? "收起外链表单" : "直接添加外链 URL"}
                </button>
              </div>

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-white/20 bg-[#0B0B0D]/60 py-8 text-center hover:border-white/45 transition"
              >
                <Upload className="h-5 w-5 text-zinc-400" />
                <div className="text-sm text-zinc-200">
                  {uploading ? uploadProgress : "拖拽多张原图到此处，或点击选择图片批量上传"}
                </div>
                <p className="text-xs text-zinc-500">
                  自动提取 EXIF、GPS 经纬度并生成 24px 真实色彩微缩柔焦显影图
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && handleFiles(e.target.files)}
                />
              </div>

              {showExternalForm && (
                <form onSubmit={handleAddExternal} className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 pt-2 text-xs">
                  <input
                    required
                    placeholder="作品标题"
                    value={extPhoto.title}
                    onChange={(e) => setExtPhoto({ ...extPhoto, title: e.target.value })}
                    className="border border-white/15 bg-[#0B0B0D] px-3 py-2 text-white"
                  />
                  <input
                    required
                    placeholder="https://... 图片外链地址"
                    value={extPhoto.url}
                    onChange={(e) => setExtPhoto({ ...extPhoto, url: e.target.value })}
                    className="sm:col-span-2 border border-white/15 bg-[#0B0B0D] px-3 py-2 text-white"
                  />
                  <div className="flex gap-1.5">
                    <input
                      placeholder="地点 (如 京都)"
                      value={extPhoto.location}
                      onChange={(e) => setExtPhoto({ ...extPhoto, location: e.target.value })}
                      className="min-w-0 flex-1 border border-white/15 bg-[#0B0B0D] px-2.5 py-2 text-white"
                    />
                    <button
                      type="button"
                      disabled={geocoding}
                      onClick={() =>
                        resolveCityGeocode(extPhoto.location, (g) =>
                          setExtPhoto({
                            ...extPhoto,
                            location: g.location,
                            locationEn: g.locationEn,
                            lat: g.lat,
                            lng: g.lng,
                          })
                        )
                      }
                      title="自动解析经纬度"
                      className="shrink-0 border border-white/15 px-2 text-zinc-300 hover:text-white cursor-pointer"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <button
                    type="submit"
                    className="bg-white px-4 py-2 font-medium text-zinc-950 hover:bg-zinc-200 cursor-pointer"
                  >
                    添加作品
                  </button>
                </form>
              )}
            </section>

            {/* Multi-Select Batch Operations Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border border-white/10 bg-[#121317] px-4 py-2.5 text-xs">
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={photoList.length > 0 && selectedIds.length === photoList.length}
                    onChange={(e) =>
                      setSelectedIds(e.target.checked ? photoList.map((p) => p.id) : [])
                    }
                  />
                  <span>全选 ({selectedIds.length}/{photoList.length})</span>
                </label>
                <span className="text-zinc-500 hidden sm:inline">· 按住左侧手柄可直接上下拖拽调整作品顺序</span>
              </div>

              {selectedIds.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        runBatchAction("category", e.target.value);
                        e.target.value = "";
                      }
                    }}
                    className="border border-white/15 bg-[#0B0B0D] px-2 py-1 text-zinc-200"
                  >
                    <option value="">批量改分类…</option>
                    <option value="landscape">自然风光</option>
                    <option value="street">城市人文</option>
                    <option value="architecture">建筑空间</option>
                    <option value="portrait">人像纪实</option>
                    <option value="still">静物日常</option>
                  </select>

                  {initialCollections.length > 0 && (
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) {
                          runBatchAction("collection", Number(e.target.value));
                          e.target.value = "";
                        }
                      }}
                      className="border border-white/15 bg-[#0B0B0D] px-2 py-1 text-zinc-200"
                    >
                      <option value="">批量归入影集…</option>
                      {initialCollections.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                  )}

                  <button
                    type="button"
                    onClick={() => runBatchAction("featured", true)}
                    className="border border-white/15 px-2.5 py-1 text-zinc-200 hover:bg-white/10 cursor-pointer"
                  >
                    设为精选
                  </button>
                  <button
                    type="button"
                    onClick={() => runBatchAction("featured", false)}
                    className="border border-white/15 px-2.5 py-1 text-zinc-400 hover:text-white cursor-pointer"
                  >
                    取消精选
                  </button>
                  <button
                    type="button"
                    onClick={() => runBatchAction("delete")}
                    className="border border-red-500/40 px-2.5 py-1 text-red-400 hover:bg-red-500/10 cursor-pointer"
                  >
                    批量删除
                  </button>
                </div>
              )}
            </div>

            {/* Draggable Photos List */}
            <section className="divide-y divide-white/8 border border-white/10 bg-[#121317]">
              {photoList.map((photo, idx) => {
                const checked = selectedIds.includes(photo.id);
                return (
                  <div
                    key={photo.id}
                    draggable
                    onDragStart={() => {
                      dragPhotoIdxRef.current = idx;
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      const from = dragPhotoIdxRef.current;
                      dragPhotoIdxRef.current = null;
                      if (from === null || from === idx) return;
                      const next = [...photoList];
                      const [moved] = next.splice(from, 1);
                      next.splice(idx, 0, moved);
                      persistPhotoOrder(next);
                    }}
                    className={`flex flex-wrap items-center justify-between gap-4 p-3.5 sm:p-4 text-sm transition ${
                      checked ? "bg-white/[0.04]" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        title="拖拽调整顺序"
                        className="cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-300"
                      >
                        <GripVertical className="h-4 w-4" />
                      </span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelectedIds((prev) =>
                            checked ? prev.filter((id) => id !== photo.id) : [...prev, photo.id]
                          )
                        }
                        className="cursor-pointer"
                      />
                      <img
                        src={photo.url}
                        alt={photo.title}
                        className="h-14 w-20 sm:h-16 sm:w-24 shrink-0 object-cover bg-zinc-900"
                      />
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2.5">
                          <span className="font-medium text-sm sm:text-base text-white truncate">{photo.title}</span>
                          {photo.titleEn && (
                            <span className="text-xs sm:text-sm text-zinc-500 truncate hidden md:inline">
                              {photo.titleEn}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-zinc-400">
                          <span>{photo.category}</span>
                          {photo.camera && <span>· {photo.camera}</span>}
                          {photo.focalMm && <span>{photo.focalMm}mm</span>}
                          {photo.location && <span>· {photo.location}</span>}
                          {photo.lat !== null && <span className="text-emerald-400/80">GPS</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleFeatured(photo)}
                        title="切换首页精选"
                        className={`inline-flex items-center gap-1 border px-2.5 py-1 text-xs transition cursor-pointer ${
                          photo.featured
                            ? "border-amber-400/50 bg-amber-400/10 text-amber-300"
                            : "border-white/10 text-zinc-500 hover:text-zinc-200"
                        }`}
                      >
                        <Star className="h-3 w-3" />
                        <span>精选</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => movePhoto(idx, -1)}
                        disabled={idx === 0}
                        aria-label="上移"
                        className="border border-white/10 p-1.5 text-zinc-400 hover:text-white disabled:opacity-25 cursor-pointer"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => movePhoto(idx, 1)}
                        disabled={idx === photoList.length - 1}
                        aria-label="下移"
                        className="border border-white/10 p-1.5 text-zinc-400 hover:text-white disabled:opacity-25 cursor-pointer"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditModal(photo)}
                        className="inline-flex items-center gap-1 border border-white/15 px-2.5 py-1 text-xs text-zinc-200 hover:bg-white/10 cursor-pointer"
                      >
                        <Pencil className="h-3 w-3" /> 编辑
                      </button>

                      <button
                        type="button"
                        onClick={() => deletePhoto(photo)}
                        aria-label="删除"
                        className="border border-white/10 p-1.5 text-zinc-500 hover:border-red-500/40 hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </section>
          </>
        )}

        {/* TAB 2: COLLECTIONS & MONOGRAPH SEQUENCER */}
        {tab === "collections" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-zinc-400">
                支持为每部影集自由插入<strong>多个画册扉页（全屏/分栏/纯文）</strong>，并为任意作品填写<strong>旁注文字</strong>。
              </p>
              <button
                type="button"
                onClick={() => openCollectionEditor()}
                className="inline-flex items-center gap-1.5 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-950 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" /> 新建影集
              </button>
            </div>

            {editingCol && (
              <form onSubmit={saveCollection} className="border border-white/15 bg-[#121317] p-5 space-y-5 text-xs">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <h3 className="text-sm font-medium text-white">
                    {editingCol.id ? "编辑专题影集与画册编排" : "新建专题影集"}
                  </h3>
                  <button type="button" onClick={() => setEditingCol(null)} className="cursor-pointer">
                    <X className="h-4 w-4 text-zinc-400" />
                  </button>
                </div>

                {/* Basic Series Metadata (for list cards & cover previews) */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <input
                    required
                    placeholder="影集名称 (中文)"
                    value={editingCol.title}
                    onChange={(e) => setEditingCol({ ...editingCol, title: e.target.value })}
                    className="border border-white/15 bg-[#0B0B0D] px-3 py-2 text-white"
                  />
                  <input
                    placeholder="英文名称 (可选)"
                    value={editingCol.titleEn}
                    onChange={(e) => setEditingCol({ ...editingCol, titleEn: e.target.value })}
                    className="border border-white/15 bg-[#0B0B0D] px-3 py-2 text-white"
                  />
                  <input
                    required
                    placeholder="路径标识 slug (如 nordic-2026)"
                    value={editingCol.slug}
                    onChange={(e) => setEditingCol({ ...editingCol, slug: e.target.value })}
                    className="border border-white/15 bg-[#0B0B0D] px-3 py-2 text-white"
                  />
                  <input
                    placeholder="时间跨度 (如 2025—2026)"
                    value={editingCol.period}
                    onChange={(e) => setEditingCol({ ...editingCol, period: e.target.value })}
                    className="border border-white/15 bg-[#0B0B0D] px-3 py-2 text-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    placeholder="列表封面图 URL"
                    value={editingCol.coverUrl}
                    onChange={(e) => setEditingCol({ ...editingCol, coverUrl: e.target.value })}
                    className="border border-white/15 bg-[#0B0B0D] px-3 py-2 text-white"
                  />
                  <input
                    placeholder="影集列表摘要 (中文)"
                    value={editingCol.description}
                    onChange={(e) => setEditingCol({ ...editingCol, description: e.target.value })}
                    className="border border-white/15 bg-[#0B0B0D] px-3 py-2 text-white"
                  />
                  <input
                    placeholder="Series Summary (EN)"
                    value={editingCol.descriptionEn}
                    onChange={(e) => setEditingCol({ ...editingCol, descriptionEn: e.target.value })}
                    className="border border-white/15 bg-[#0B0B0D] px-3 py-2 text-white"
                  />
                </div>

                {/* Photo Selector Grid */}
                <div className="space-y-2 border-t border-white/10 pt-4">
                  <div className="text-zinc-300 font-medium">
                    1. 点击选择收录进本影集的作品：
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 max-h-48 overflow-y-auto p-1">
                    {photoList.map((p) => {
                      const active = editingCol.blocks.some((b) => b.kind === "photo" && b.photoId === p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => togglePhotoInMonograph(p.id)}
                          className={`relative aspect-[3/2] overflow-hidden border text-left cursor-pointer ${
                            active ? "border-white ring-1 ring-white" : "border-white/10 opacity-45 hover:opacity-85"
                          }`}
                        >
                          <img src={p.url} alt={p.title} className="h-full w-full object-cover" />
                          {active && (
                            <span className="absolute top-1 right-1 bg-white p-0.5 text-black">
                              <Check className="h-2.5 w-2.5" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Monograph Multi-Cover & Photo Side-Note Sequencer */}
                <div className="space-y-3 border-t border-white/10 pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-zinc-200 font-medium">
                      2. 画册页面编排（共 {editingCol.blocks.length} 节 · 可添加多个扉页、拖拽排序、为照片添加旁注）：
                    </div>
                    <button
                      type="button"
                      onClick={addCoverBlock}
                      className="inline-flex items-center gap-1 border border-white/25 bg-white/10 px-3 py-1.5 text-white hover:bg-white/20 transition cursor-pointer"
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      <span>+ 添加画册扉页</span>
                    </button>
                  </div>

                  <div className="space-y-2.5 max-h-[56dvh] overflow-y-auto pr-1">
                    {editingCol.blocks.map((block, bIdx) => {
                      if (block.kind === "cover") {
                        return (
                          <div
                            key={block.id}
                            draggable
                            onDragStart={() => {
                              dragBlockIdxRef.current = bIdx;
                            }}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => {
                              const from = dragBlockIdxRef.current;
                              dragBlockIdxRef.current = null;
                              if (from === null || from === bIdx) return;
                              const next = [...editingCol.blocks];
                              const [moved] = next.splice(from, 1);
                              next.splice(bIdx, 0, moved);
                              setEditingCol({ ...editingCol, blocks: next });
                            }}
                            className="border border-amber-400/30 bg-amber-400/[0.04] p-3.5 space-y-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="inline-flex items-center gap-2 text-amber-300 font-medium">
                                <GripVertical className="h-4 w-4 cursor-grab text-zinc-500" />
                                <BookOpen className="h-3.5 w-3.5" />
                                <span>画册扉页 #{bIdx + 1}</span>
                                <select
                                  value={block.style}
                                  onChange={(e) => updateBlockAt(bIdx, { style: e.target.value as CoverStyle })}
                                  className="ml-2 border border-white/15 bg-[#0B0B0D] px-2 py-1 text-xs text-white"
                                >
                                  <option value="full">全屏大图扉页</option>
                                  <option value="split">左右图文分栏扉页</option>
                                  <option value="minimal">纯文字留白章节页</option>
                                </select>
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => moveBlock(bIdx, -1)}
                                  disabled={bIdx === 0}
                                  className="border border-white/10 p-1 text-zinc-400 hover:text-white disabled:opacity-25 cursor-pointer"
                                >
                                  <ArrowUp className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveBlock(bIdx, 1)}
                                  disabled={bIdx === editingCol.blocks.length - 1}
                                  className="border border-white/10 p-1 text-zinc-400 hover:text-white disabled:opacity-25 cursor-pointer"
                                >
                                  <ArrowDown className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeBlockAt(bIdx)}
                                  className="border border-white/10 p-1 text-zinc-400 hover:text-red-400 cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>

                            {block.style !== "minimal" && (
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <input
                                  placeholder="扉页背景图 URL"
                                  value={block.imageUrl}
                                  onChange={(e) => updateBlockAt(bIdx, { imageUrl: e.target.value })}
                                  className="sm:col-span-2 border border-white/15 bg-[#0B0B0D] px-2.5 py-1.5 text-white"
                                />
                                <select
                                  value=""
                                  onChange={(e) => {
                                    if (e.target.value) updateBlockAt(bIdx, { imageUrl: e.target.value });
                                  }}
                                  className="border border-white/15 bg-[#0B0B0D] px-2.5 py-1.5 text-zinc-300"
                                >
                                  <option value="">从作品库选背景图…</option>
                                  {photoList.map((p) => (
                                    <option key={p.id} value={p.url}>
                                      {p.title}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                              <input
                                placeholder="眉题 / 章节号 (如 CHAPTER II)"
                                value={block.eyebrow}
                                onChange={(e) =>
                                  updateBlockAt(bIdx, { eyebrow: e.target.value, eyebrowEn: e.target.value })
                                }
                                className="border border-white/15 bg-[#0B0B0D] px-2.5 py-1.5 text-white"
                              />
                              <input
                                placeholder="扉页主标题 (中文)"
                                value={block.title}
                                onChange={(e) => updateBlockAt(bIdx, { title: e.target.value })}
                                className="sm:col-span-2 border border-white/15 bg-[#0B0B0D] px-2.5 py-1.5 text-white"
                              />
                              <input
                                placeholder="扉页英文标题 (可选)"
                                value={block.titleEn}
                                onChange={(e) => updateBlockAt(bIdx, { titleEn: e.target.value })}
                                className="border border-white/15 bg-[#0B0B0D] px-2.5 py-1.5 text-white"
                              />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <textarea
                                rows={2}
                                placeholder="扉页导语 / 序言正文 (中文)"
                                value={block.body}
                                onChange={(e) => updateBlockAt(bIdx, { body: e.target.value })}
                                className="border border-white/15 bg-[#0B0B0D] p-2 text-white"
                              />
                              <textarea
                                rows={2}
                                placeholder="Preface / Chapter Text (EN, 可选)"
                                value={block.bodyEn}
                                onChange={(e) => updateBlockAt(bIdx, { bodyEn: e.target.value })}
                                className="border border-white/15 bg-[#0B0B0D] p-2 text-white"
                              />
                            </div>
                          </div>
                        );
                      }

                      const p = photoMap.get(block.photoId);
                      if (!p) return null;

                      return (
                        <div
                          key={block.id}
                          draggable
                          onDragStart={() => {
                            dragBlockIdxRef.current = bIdx;
                          }}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            const from = dragBlockIdxRef.current;
                            dragBlockIdxRef.current = null;
                            if (from === null || from === bIdx) return;
                            const next = [...editingCol.blocks];
                            const [moved] = next.splice(from, 1);
                            next.splice(bIdx, 0, moved);
                            setEditingCol({ ...editingCol, blocks: next });
                          }}
                          className="border border-white/10 bg-[#0B0B0D]/80 p-3 space-y-2.5"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-zinc-600" />
                              <img src={p.url} alt="" className="h-10 w-14 shrink-0 object-cover bg-zinc-900" />
                              <div className="min-w-0">
                                <div className="truncate font-medium text-white">{p.title}</div>
                                <div className="text-[11px] text-zinc-500">{p.location}</div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <select
                                value={block.noteAlign}
                                onChange={(e) =>
                                  updateBlockAt(bIdx, { noteAlign: e.target.value as "right" | "left" })
                                }
                                className="border border-white/15 bg-[#121317] px-2 py-1 text-[11px] text-zinc-300"
                              >
                                <option value="right">旁注在右</option>
                                <option value="left">旁注在左</option>
                              </select>
                              <button
                                type="button"
                                onClick={() => moveBlock(bIdx, -1)}
                                disabled={bIdx === 0}
                                className="border border-white/10 p-1 text-zinc-400 hover:text-white disabled:opacity-25 cursor-pointer"
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveBlock(bIdx, 1)}
                                disabled={bIdx === editingCol.blocks.length - 1}
                                className="border border-white/10 p-1 text-zinc-400 hover:text-white disabled:opacity-25 cursor-pointer"
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeBlockAt(bIdx)}
                                className="border border-white/10 p-1 text-zinc-500 hover:text-red-400 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              placeholder="照片旁注文字 (填写后前台呈图文并排画册页，留空则纯图展示)"
                              value={block.sideNote}
                              onChange={(e) => updateBlockAt(bIdx, { sideNote: e.target.value })}
                              className="border border-white/12 bg-[#121317] px-2.5 py-1.5 text-white placeholder:text-zinc-600"
                            />
                            <input
                              placeholder="Side Note (EN, 可选)"
                              value={block.sideNoteEn}
                              onChange={(e) => updateBlockAt(bIdx, { sideNoteEn: e.target.value })}
                              className="border border-white/12 bg-[#121317] px-2.5 py-1.5 text-white placeholder:text-zinc-600"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-white/10 pt-3">
                  <button
                    type="button"
                    onClick={() => setEditingCol(null)}
                    className="border border-white/15 px-4 py-2 text-zinc-300 cursor-pointer"
                  >
                    取消
                  </button>
                  <button type="submit" className="bg-white px-5 py-2 font-medium text-zinc-950 cursor-pointer">
                    保存影集与画册编排
                  </button>
                </div>
              </form>
            )}

            <div className="divide-y divide-white/8 border border-white/10 bg-[#121317]">
              {initialCollections.map((col) => {
                const parsedBlocks = parseMonographBlocks(col.blocksJson, col);
                const coverCount = parsedBlocks.filter((b) => b.kind === "cover").length;
                return (
                  <div key={col.id} className="flex flex-wrap items-center justify-between gap-4 p-4 text-xs">
                    <div className="flex items-center gap-4">
                      {col.coverUrl && (
                        <img src={col.coverUrl} alt={col.title} className="h-14 w-22 object-cover bg-zinc-900" />
                      )}
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-white">
                          {col.title} <span className="text-xs text-zinc-500">/{col.slug}</span>
                        </div>
                        <div className="text-zinc-400">
                          {col.period} · {col.photoCount} 幅作品 · {coverCount} 个画册扉页
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openCollectionEditor(col)}
                        className="border border-white/15 px-3 py-1.5 text-zinc-200 hover:bg-white/10 cursor-pointer"
                      >
                        编辑画册与扉页
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteCollection(col.id, col.title)}
                        className="border border-white/10 p-1.5 text-zinc-500 hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: GEAR */}
        {tab === "gear" && (
          <div className="space-y-6 text-xs">
            <form onSubmit={addGearItem} className="border border-white/10 bg-[#121317] p-5 space-y-3">
              <div className="text-sm font-medium text-white">新增器材条目（名称与照片 EXIF 一致时会自动关联样片数）</div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <select
                  value={newGear.type}
                  onChange={(e) => setNewGear({ ...newGear, type: e.target.value })}
                  className="border border-white/15 bg-[#0B0B0D] px-3 py-2 text-white"
                >
                  <option value="camera">相机机身</option>
                  <option value="lens">光学镜头</option>
                </select>
                <input
                  placeholder="品牌 (如 Leica)"
                  value={newGear.brand}
                  onChange={(e) => setNewGear({ ...newGear, brand: e.target.value })}
                  className="border border-white/15 bg-[#0B0B0D] px-3 py-2 text-white"
                />
                <input
                  required
                  placeholder="完整型号 (如 Leica M11)"
                  value={newGear.name}
                  onChange={(e) => setNewGear({ ...newGear, name: e.target.value })}
                  className="border border-white/15 bg-[#0B0B0D] px-3 py-2 text-white"
                />
                <input
                  placeholder="规格参数 (如 60MP Rangefinder)"
                  value={newGear.specs}
                  onChange={(e) => setNewGear({ ...newGear, specs: e.target.value })}
                  className="border border-white/15 bg-[#0B0B0D] px-3 py-2 text-white"
                />
              </div>
              <div className="flex gap-3">
                <input
                  placeholder="使用心得说明"
                  value={newGear.note}
                  onChange={(e) => setNewGear({ ...newGear, note: e.target.value })}
                  className="flex-1 border border-white/15 bg-[#0B0B0D] px-3 py-2 text-white"
                />
                <button type="submit" className="bg-white px-5 py-2 font-medium text-zinc-950 shrink-0 cursor-pointer">
                  添加器材
                </button>
              </div>
            </form>

            <div className="divide-y divide-white/8 border border-white/10 bg-[#121317]">
              {initialGear.map((g) => (
                <div key={g.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase text-zinc-500">
                        {g.type === "camera" ? "BODY" : "LENS"}
                      </span>
                      <span className="text-sm font-medium text-white">{g.name}</span>
                      <span className="text-zinc-400">({g.photoCount} 幅关联作品)</span>
                    </div>
                    {g.note && <p className="text-zinc-400">{g.note}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeGearItem(g.id)}
                    className="border border-white/10 p-1.5 text-zinc-500 hover:text-red-400 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: FULL SITE & ABOUT SETTINGS */}
        {tab === "settings" && (
          <form onSubmit={saveSettings} className="space-y-6 text-xs">
            {/* Feature Switches */}
            <section className="border border-white/10 bg-[#121317] p-5 space-y-4">
              <h3 className="text-sm font-medium text-white">全局功能开关</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex items-start gap-3 border border-white/10 bg-[#0B0B0D] p-3.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settingsForm.copyrightGuard === "true"}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, copyrightGuard: e.target.checked ? "true" : "false" })
                    }
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <div className="font-medium text-white">开启原图下载保护</div>
                    <p className="text-zinc-400">禁用前台右键另存与拖拽图片，隐藏灯箱“原图”链接，仅允许导出带署名的签名框。</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 border border-white/10 bg-[#0B0B0D] p-3.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settingsForm.showShootingStats !== "false"}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, showShootingStats: e.target.checked ? "true" : "false" })
                    }
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <div className="font-medium text-white">关于页展示「拍摄习惯统计」</div>
                    <p className="text-zinc-400">根据已发布作品自动统计常用焦段、机身使用率与题材构成。</p>
                  </div>
                </label>
              </div>
            </section>

            {/* Photographer Profile & Domain */}
            <section className="border border-white/10 bg-[#121317] p-5 space-y-4">
              <h3 className="text-sm font-medium text-white">摄影师资料与站点基础信息</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  ["photographerName", "摄影师署名 (中文)"],
                  ["photographerNameEn", "Photographer Name (EN)"],
                  ["avatarUrl", "个人头像 URL (如 /samples/avatar.jpg)"],
                  ["siteUrl", "站点公开域名 (用于 RSS / Sitemap / 分享链接)"],
                  ["tagline", "一句话简介 (中文)"],
                  ["taglineEn", "Tagline (EN)"],
                  ["baseLocation", "常驻城市 (中文)"],
                  ["baseLocationEn", "Base Location (EN)"],
                  ["aboutAvailableText", "关于页状态标签 (中文，留空则隐藏)"],
                  ["aboutAvailableTextEn", "Availability Badge (EN)"],
                  ["email", "联系邮箱"],
                  ["instagram", "Instagram 链接 (留空隐藏)"],
                  ["xiaohongshu", "小红书主页链接 (留空隐藏)"],
                  ["aboutContactNote", "联系方式底部提示 (中文)"],
                  ["aboutContactNoteEn", "Contact Note (EN)"],
                ].map(([key, label]) => (
                  <label key={key} className="space-y-1.5 block">
                    <span className="text-zinc-400">{label}</span>
                    <input
                      value={settingsForm[key] || ""}
                      onChange={(e) => setSettingsForm({ ...settingsForm, [key]: e.target.value })}
                      className="w-full border border-white/15 bg-[#0B0B0D] px-3 py-2 text-white"
                    />
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="space-y-1.5 block">
                  <span className="text-zinc-400">个人创作自述 (中文，支持多段换行)</span>
                  <textarea
                    rows={4}
                    value={settingsForm.bio || ""}
                    onChange={(e) => setSettingsForm({ ...settingsForm, bio: e.target.value })}
                    className="w-full border border-white/15 bg-[#0B0B0D] p-3 text-white"
                  />
                </label>
                <label className="space-y-1.5 block">
                  <span className="text-zinc-400">Statement / Biography (EN)</span>
                  <textarea
                    rows={4}
                    value={settingsForm.bioEn || ""}
                    onChange={(e) => setSettingsForm({ ...settingsForm, bioEn: e.target.value })}
                    className="w-full border border-white/15 bg-[#0B0B0D] p-3 text-white"
                  />
                </label>
              </div>
            </section>

            {/* About Focus Cards Editor */}
            <section className="border border-white/10 bg-[#121317] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-white">关于页 · 拍摄方向与合作卡片</h3>
                <button
                  type="button"
                  onClick={() =>
                    setFocusList([
                      ...focusList,
                      { icon: "compass", title: "", titleEn: "", desc: "", descEn: "" },
                    ])
                  }
                  className="inline-flex items-center gap-1 border border-white/20 px-2.5 py-1 text-zinc-200 hover:bg-white/10 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" /> 添加卡片
                </button>
              </div>

              <div className="space-y-2.5">
                {focusList.map((item, idx) => (
                  <div key={idx} className="border border-white/10 bg-[#0B0B0D] p-3 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
                      <select
                        value={item.icon}
                        onChange={(e) =>
                          setFocusList(focusList.map((f, i) => (i === idx ? { ...f, icon: e.target.value } : f)))
                        }
                        className="border border-white/15 bg-[#121317] px-2 py-1.5 text-white"
                      >
                        <option value="compass">指南针图标</option>
                        <option value="building">建筑图标</option>
                        <option value="aperture">光圈图标</option>
                        <option value="frame">画框图标</option>
                      </select>
                      <input
                        placeholder="标题 (中文)"
                        value={item.title}
                        onChange={(e) =>
                          setFocusList(focusList.map((f, i) => (i === idx ? { ...f, title: e.target.value } : f)))
                        }
                        className="sm:col-span-2 border border-white/15 bg-[#121317] px-2.5 py-1.5 text-white"
                      />
                      <input
                        placeholder="Title (EN)"
                        value={item.titleEn}
                        onChange={(e) =>
                          setFocusList(focusList.map((f, i) => (i === idx ? { ...f, titleEn: e.target.value } : f)))
                        }
                        className="sm:col-span-2 border border-white/15 bg-[#121317] px-2.5 py-1.5 text-white"
                      />
                      <button
                        type="button"
                        onClick={() => setFocusList(focusList.filter((_, i) => i !== idx))}
                        className="border border-white/10 px-2 py-1.5 text-zinc-400 hover:text-red-400 cursor-pointer"
                      >
                        删除
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        placeholder="说明 (中文)"
                        value={item.desc}
                        onChange={(e) =>
                          setFocusList(focusList.map((f, i) => (i === idx ? { ...f, desc: e.target.value } : f)))
                        }
                        className="border border-white/15 bg-[#121317] px-2.5 py-1.5 text-white"
                      />
                      <input
                        placeholder="Description (EN)"
                        value={item.descEn}
                        onChange={(e) =>
                          setFocusList(focusList.map((f, i) => (i === idx ? { ...f, descEn: e.target.value } : f)))
                        }
                        className="border border-white/15 bg-[#121317] px-2.5 py-1.5 text-white"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* About Exhibitions & Milestones Editor */}
            <section className="border border-white/10 bg-[#121317] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-white">关于页 · 展览与出版记录</h3>
                <button
                  type="button"
                  onClick={() =>
                    setMilestoneList([
                      ...milestoneList,
                      { year: "2026", title: "", titleEn: "", place: "", placeEn: "" },
                    ])
                  }
                  className="inline-flex items-center gap-1 border border-white/20 px-2.5 py-1 text-zinc-200 hover:bg-white/10 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" /> 添加记录
                </button>
              </div>

              <div className="space-y-2">
                {milestoneList.map((m, idx) => (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 border border-white/10 bg-[#0B0B0D] p-2.5">
                    <input
                      placeholder="年份"
                      value={m.year}
                      onChange={(e) =>
                        setMilestoneList(milestoneList.map((x, i) => (i === idx ? { ...x, year: e.target.value } : x)))
                      }
                      className="sm:col-span-2 border border-white/15 bg-[#121317] px-2.5 py-1.5 text-white"
                    />
                    <input
                      placeholder="展览/出版标题 (中文)"
                      value={m.title}
                      onChange={(e) =>
                        setMilestoneList(milestoneList.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x)))
                      }
                      className="sm:col-span-3 border border-white/15 bg-[#121317] px-2.5 py-1.5 text-white"
                    />
                    <input
                      placeholder="Title (EN)"
                      value={m.titleEn}
                      onChange={(e) =>
                        setMilestoneList(milestoneList.map((x, i) => (i === idx ? { ...x, titleEn: e.target.value } : x)))
                      }
                      className="sm:col-span-3 border border-white/15 bg-[#121317] px-2.5 py-1.5 text-white"
                    />
                    <input
                      placeholder="地点/备注 (中文)"
                      value={m.place}
                      onChange={(e) =>
                        setMilestoneList(milestoneList.map((x, i) => (i === idx ? { ...x, place: e.target.value } : x)))
                      }
                      className="sm:col-span-2 border border-white/15 bg-[#121317] px-2.5 py-1.5 text-white"
                    />
                    <input
                      placeholder="Place (EN)"
                      value={m.placeEn}
                      onChange={(e) =>
                        setMilestoneList(milestoneList.map((x, i) => (i === idx ? { ...x, placeEn: e.target.value } : x)))
                      }
                      className="sm:col-span-1 border border-white/15 bg-[#121317] px-2 py-1.5 text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setMilestoneList(milestoneList.filter((_, i) => i !== idx))}
                      className="sm:col-span-1 border border-white/10 px-2 py-1.5 text-zinc-400 hover:text-red-400 cursor-pointer"
                    >
                      删除
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <div className="flex justify-end">
              <button type="submit" className="bg-white px-6 py-2.5 font-medium text-zinc-950 hover:bg-zinc-200 cursor-pointer">
                保存全部配置
              </button>
            </div>
          </form>
        )}
      </main>

      {/* Edit Photo Modal */}
      {editingPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
          <form
            onSubmit={saveEditedPhoto}
            className="w-full max-w-2xl border border-white/15 bg-[#121317] p-6 space-y-4 text-xs my-8"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-medium text-white">编辑作品详情 · #{editingPhoto.id}</h3>
              <button type="button" onClick={() => setEditingPhoto(null)} className="cursor-pointer">
                <X className="h-4 w-4 text-zinc-400" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-zinc-400">中文标题</span>
                <input
                  required
                  value={editingPhoto.title}
                  onChange={(e) => setEditingPhoto({ ...editingPhoto, title: e.target.value })}
                  className="w-full border border-white/15 bg-[#0B0B0D] px-3 py-1.5 text-white"
                />
              </label>
              <label className="space-y-1">
                <span className="text-zinc-400">英文标题</span>
                <input
                  value={editingPhoto.titleEn}
                  onChange={(e) => setEditingPhoto({ ...editingPhoto, titleEn: e.target.value })}
                  className="w-full border border-white/15 bg-[#0B0B0D] px-3 py-1.5 text-white"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-zinc-400">拍摄说明 (中文)</span>
                <textarea
                  rows={2}
                  value={editingPhoto.description}
                  onChange={(e) => setEditingPhoto({ ...editingPhoto, description: e.target.value })}
                  className="w-full border border-white/15 bg-[#0B0B0D] p-2 text-white"
                />
              </label>
              <label className="space-y-1">
                <span className="text-zinc-400">Description (EN)</span>
                <textarea
                  rows={2}
                  value={editingPhoto.descriptionEn}
                  onChange={(e) => setEditingPhoto({ ...editingPhoto, descriptionEn: e.target.value })}
                  className="w-full border border-white/15 bg-[#0B0B0D] p-2 text-white"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <label className="space-y-1">
                <span className="text-zinc-400">分类</span>
                <select
                  value={editingPhoto.category}
                  onChange={(e) => setEditingPhoto({ ...editingPhoto, category: e.target.value })}
                  className="w-full border border-white/15 bg-[#0B0B0D] px-2.5 py-1.5 text-white"
                >
                  <option value="landscape">自然风光</option>
                  <option value="street">城市人文</option>
                  <option value="architecture">建筑空间</option>
                  <option value="portrait">人像纪实</option>
                  <option value="still">静物日常</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-zinc-400">拍摄日期</span>
                <input
                  value={editingPhoto.takenAt}
                  onChange={(e) => setEditingPhoto({ ...editingPhoto, takenAt: e.target.value })}
                  placeholder="2026-01-15"
                  className="w-full border border-white/15 bg-[#0B0B0D] px-2.5 py-1.5 text-white"
                />
              </label>
              <label className="space-y-1">
                <span className="text-zinc-400 flex items-center justify-between">
                  <span>地点 (中文)</span>
                  <button
                    type="button"
                    disabled={geocoding}
                    onClick={() =>
                      resolveCityGeocode(editingPhoto.location || editingPhoto.locationEn, (g) =>
                        setEditingPhoto({
                          ...editingPhoto,
                          location: editingPhoto.location || g.location,
                          locationEn: editingPhoto.locationEn || g.locationEn,
                          lat: g.lat,
                          lng: g.lng,
                        })
                      )
                    }
                    className="text-emerald-400 hover:underline cursor-pointer"
                  >
                    自动定位
                  </button>
                </span>
                <input
                  value={editingPhoto.location}
                  onChange={(e) => setEditingPhoto({ ...editingPhoto, location: e.target.value })}
                  placeholder="如：京都, 日本"
                  className="w-full border border-white/15 bg-[#0B0B0D] px-2.5 py-1.5 text-white"
                />
              </label>
              <label className="space-y-1">
                <span className="text-zinc-400">Location (EN)</span>
                <input
                  value={editingPhoto.locationEn}
                  onChange={(e) => setEditingPhoto({ ...editingPhoto, locationEn: e.target.value })}
                  className="w-full border border-white/15 bg-[#0B0B0D] px-2.5 py-1.5 text-white"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <label className="space-y-1 sm:col-span-2">
                <span className="text-zinc-400">相机机身</span>
                <input
                  value={editingPhoto.camera}
                  onChange={(e) => setEditingPhoto({ ...editingPhoto, camera: e.target.value })}
                  className="w-full border border-white/15 bg-[#0B0B0D] px-2.5 py-1.5 text-white"
                />
              </label>
              <label className="space-y-1 sm:col-span-2">
                <span className="text-zinc-400">镜头型号</span>
                <input
                  value={editingPhoto.lens}
                  onChange={(e) => setEditingPhoto({ ...editingPhoto, lens: e.target.value })}
                  className="w-full border border-white/15 bg-[#0B0B0D] px-2.5 py-1.5 text-white"
                />
              </label>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
              <label className="space-y-1">
                <span className="text-zinc-400">焦段(mm)</span>
                <input
                  type="number"
                  value={editingPhoto.focalMm ?? ""}
                  onChange={(e) =>
                    setEditingPhoto({ ...editingPhoto, focalMm: e.target.value ? Number(e.target.value) : null })
                  }
                  className="w-full border border-white/15 bg-[#0B0B0D] px-2 py-1.5 text-white"
                />
              </label>
              <label className="space-y-1">
                <span className="text-zinc-400">光圈</span>
                <input
                  value={editingPhoto.aperture}
                  onChange={(e) => setEditingPhoto({ ...editingPhoto, aperture: e.target.value })}
                  placeholder="f/2.0"
                  className="w-full border border-white/15 bg-[#0B0B0D] px-2 py-1.5 text-white"
                />
              </label>
              <label className="space-y-1">
                <span className="text-zinc-400">快门</span>
                <input
                  value={editingPhoto.shutter}
                  onChange={(e) => setEditingPhoto({ ...editingPhoto, shutter: e.target.value })}
                  placeholder="1/250s"
                  className="w-full border border-white/15 bg-[#0B0B0D] px-2 py-1.5 text-white"
                />
              </label>
              <label className="space-y-1">
                <span className="text-zinc-400">ISO</span>
                <input
                  type="number"
                  value={editingPhoto.iso ?? ""}
                  onChange={(e) =>
                    setEditingPhoto({ ...editingPhoto, iso: e.target.value ? Number(e.target.value) : null })
                  }
                  className="w-full border border-white/15 bg-[#0B0B0D] px-2 py-1.5 text-white"
                />
              </label>
              <label className="space-y-1">
                <span className="text-zinc-400">纬度 Lat</span>
                <input
                  type="number"
                  step="any"
                  value={editingPhoto.lat ?? ""}
                  onChange={(e) =>
                    setEditingPhoto({ ...editingPhoto, lat: e.target.value === "" ? null : Number(e.target.value) })
                  }
                  className="w-full border border-white/15 bg-[#0B0B0D] px-2 py-1.5 text-white"
                />
              </label>
              <label className="space-y-1">
                <span className="text-zinc-400">经度 Lng</span>
                <input
                  type="number"
                  step="any"
                  value={editingPhoto.lng ?? ""}
                  onChange={(e) =>
                    setEditingPhoto({ ...editingPhoto, lng: e.target.value === "" ? null : Number(e.target.value) })
                  }
                  className="w-full border border-white/15 bg-[#0B0B0D] px-2 py-1.5 text-white"
                />
              </label>
            </div>

            {initialCollections.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-zinc-400">所属专题影集：</span>
                <div className="flex flex-wrap gap-3">
                  {initialCollections.map((c) => {
                    const checked = editingColIds.includes(c.id);
                    return (
                      <label key={c.id} className="inline-flex items-center gap-1.5 text-zinc-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setEditingColIds(
                              checked ? editingColIds.filter((id) => id !== c.id) : [...editingColIds, c.id]
                            )
                          }
                        />
                        {c.title}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={() => setEditingPhoto(null)}
                className="border border-white/15 px-4 py-2 text-zinc-300 cursor-pointer"
              >
                取消
              </button>
              <button type="submit" className="bg-white px-5 py-2 font-medium text-zinc-950 cursor-pointer">
                保存修改
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
