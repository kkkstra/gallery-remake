"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ExternalLink,
  LogOut,
  Pencil,
  Plus,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { GearItem, Photo } from "@/lib/db/schema";
import type { CollectionWithPhotos } from "@/lib/queries";

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
          // Darken average color to darkroom ambient range
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

  // Upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [batchCategory, setBatchCategory] = useState("landscape");
  const [batchFeatured, setBatchFeatured] = useState(true);
  const [batchColId, setBatchColId] = useState("0");
  const [showExternalForm, setShowExternalForm] = useState(false);
  const [extPhoto, setExtPhoto] = useState({ title: "", url: "", category: "landscape", location: "" });

  // Edit Photo modal
  const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null);
  const [editingColIds, setEditingColIds] = useState<number[]>([]);

  // Collection form
  const [editingCol, setEditingCol] = useState<{
    id?: number;
    slug: string;
    title: string;
    titleEn: string;
    period: string;
    coverUrl: string;
    description: string;
    descriptionEn: string;
    photoIds: number[];
  } | null>(null);

  // Gear form
  const [newGear, setNewGear] = useState({
    type: "camera",
    brand: "",
    name: "",
    specs: "",
    note: "",
    noteEn: "",
  });

  // Settings form
  const [settingsForm, setSettingsForm] = useState<Record<string, string>>(initialSettings);

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
              className="w-full border border-white/15 bg-[#0B0B0D] px-3 py-2 text-sm text-white outline-none focus:border-white/50"
            />
            {loginErr && <p className="text-xs text-red-400">{loginErr}</p>}
          </div>

          <div className="flex items-center justify-between pt-1">
            <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300">
              ← 返回前台
            </Link>
            <button
              type="submit"
              className="bg-white px-4 py-2 text-xs font-medium text-zinc-950 hover:bg-zinc-200 transition"
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
      setExtPhoto({ title: "", url: "", category: "landscape", location: "" });
      setShowExternalForm(false);
      notify("已添加外链作品");
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

  const movePhoto = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= initialPhotos.length) return;
    const ids = initialPhotos.map((p) => p.id);
    [ids[idx], ids[target]] = [ids[target], ids[idx]];
    await fetch("/api/admin/photos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: ids }),
    });
    router.refresh();
  };

  const deletePhoto = async (photo: Photo) => {
    if (!confirm(`确认删除《${photo.title}》？`)) return;
    await fetch(`/api/admin/photos/${photo.id}`, { method: "DELETE" });
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

  const saveCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCol) return;
    const url = editingCol.id
      ? `/api/admin/collections/${editingCol.id}`
      : "/api/admin/collections";
    const method = editingCol.id ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingCol),
    });
    if (res.ok) {
      setEditingCol(null);
      notify("影集已保存");
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
    await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settingsForm),
    });
    notify("个人资料与站点设置已保存");
    router.refresh();
  };

  return (
    <div className="min-h-dvh bg-[#0B0B0D] text-zinc-200 pb-24">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0B0B0D]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4 text-sm">
          <div className="flex items-center gap-7">
            <span className="text-base font-medium text-white">摄影站管理台</span>
            <nav className="flex items-center gap-5">
              {(
                [
                  ["photos", `作品管理 (${initialPhotos.length})`],
                  ["collections", `专题影集 (${initialCollections.length})`],
                  ["gear", `器材档案 (${initialGear.length})`],
                  ["settings", "个人资料与站点"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTab(k)}
                  className={`pb-0.5 transition ${
                    tab === k ? "text-white border-b border-white font-medium" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-4 text-zinc-400">
            <span className="font-mono-tech text-[11px]">
              存储: {storageMode === "s3" ? "S3 对象存储" : "本地 data/uploads"}
            </span>
            <Link href="/" target="_blank" className="inline-flex items-center gap-1 hover:text-white">
              查看前台 <ExternalLink className="h-3 w-3" />
            </Link>
            <button type="button" onClick={handleLogout} className="inline-flex items-center gap-1 hover:text-white">
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

      <main className="mx-auto max-w-6xl px-5 pt-8 space-y-8">
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
                  className="inline-flex items-center gap-1 text-zinc-300 hover:text-white underline underline-offset-4"
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
                className="flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-white/20 bg-[#0B0B0D]/60 py-9 text-center hover:border-white/45 transition"
              >
                <Upload className="h-5 w-5 text-zinc-400" />
                <div className="text-sm text-zinc-200">
                  {uploading ? uploadProgress : "拖拽多张原图到此处，或点击选择图片批量上传"}
                </div>
                <p className="text-xs text-zinc-500">
                  自动提取机身、镜头、光圈、快门、ISO、拍摄日期、GPS 经纬度与画幅尺寸
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
                <form onSubmit={handleAddExternal} className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 text-xs">
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
                  <button
                    type="submit"
                    className="bg-white px-4 py-2 font-medium text-zinc-950 hover:bg-zinc-200"
                  >
                    添加作品
                  </button>
                </form>
              )}
            </section>

            {/* Photos List */}
            <section className="divide-y divide-white/8 border border-white/10 bg-[#121317]">
              {initialPhotos.map((photo, idx) => (
                <div key={photo.id} className="flex flex-wrap items-center justify-between gap-4 p-4 text-sm">
                  <div className="flex items-center gap-4 min-w-0">
                    <img
                      src={photo.url}
                      alt={photo.title}
                      className="h-16 w-24 shrink-0 object-cover bg-zinc-900"
                    />
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span className="font-medium text-base text-white truncate">{photo.title}</span>
                        {photo.titleEn && (
                          <span className="text-sm text-zinc-500 truncate hidden sm:inline">{photo.titleEn}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono-tech text-xs text-zinc-400">
                        <span>{photo.category}</span>
                        {photo.camera && <span>· {photo.camera}</span>}
                        {photo.focalMm && <span>{photo.focalMm}mm</span>}
                        {photo.aperture && <span>{photo.aperture}</span>}
                        {photo.location && <span>· {photo.location}</span>}
                        {photo.lat !== null && <span className="text-emerald-400/80">GPS</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleFeatured(photo)}
                      title="切换首页剧场精选"
                      className={`inline-flex items-center gap-1 border px-2.5 py-1 transition ${
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
                      className="border border-white/10 p-1.5 text-zinc-400 hover:text-white disabled:opacity-25"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => movePhoto(idx, 1)}
                      disabled={idx === initialPhotos.length - 1}
                      aria-label="下移"
                      className="border border-white/10 p-1.5 text-zinc-400 hover:text-white disabled:opacity-25"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditModal(photo)}
                      className="inline-flex items-center gap-1 border border-white/15 px-2.5 py-1 text-zinc-200 hover:bg-white/10"
                    >
                      <Pencil className="h-3 w-3" /> 编辑
                    </button>

                    <button
                      type="button"
                      onClick={() => deletePhoto(photo)}
                      aria-label="删除"
                      className="border border-white/10 p-1.5 text-zinc-500 hover:border-red-500/40 hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </section>
          </>
        )}

        {/* TAB 2: COLLECTIONS */}
        {tab === "collections" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-400">按主题或旅途编排作品，前台将以「留白画册」版式呈现。</p>
              <button
                type="button"
                onClick={() =>
                  setEditingCol({
                    slug: "",
                    title: "",
                    titleEn: "",
                    period: "2026",
                    coverUrl: initialPhotos[0]?.url || "",
                    description: "",
                    descriptionEn: "",
                    photoIds: [],
                  })
                }
                className="inline-flex items-center gap-1.5 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-950"
              >
                <Plus className="h-3.5 w-3.5" /> 新建影集
              </button>
            </div>

            {editingCol && (
              <form onSubmit={saveCollection} className="border border-white/15 bg-[#121317] p-5 space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <h3 className="text-sm font-medium text-white">
                    {editingCol.id ? "编辑专题影集" : "新建专题影集"}
                  </h3>
                  <button type="button" onClick={() => setEditingCol(null)}>
                    <X className="h-4 w-4 text-zinc-400" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <input
                    required
                    placeholder="中文标题"
                    value={editingCol.title}
                    onChange={(e) => setEditingCol({ ...editingCol, title: e.target.value })}
                    className="border border-white/15 bg-[#0B0B0D] px-3 py-2 text-white"
                  />
                  <input
                    placeholder="英文标题 (可选)"
                    value={editingCol.titleEn}
                    onChange={(e) => setEditingCol({ ...editingCol, titleEn: e.target.value })}
                    className="border border-white/15 bg-[#0B0B0D] px-3 py-2 text-white"
                  />
                  <input
                    required
                    placeholder="URL 路径标识 (如 nordic-2026)"
                    value={editingCol.slug}
                    onChange={(e) => setEditingCol({ ...editingCol, slug: e.target.value })}
                    className="border border-white/15 bg-[#0B0B0D] px-3 py-2 font-mono-tech text-white"
                  />
                  <input
                    placeholder="时间跨度 (如 2025—2026)"
                    value={editingCol.period}
                    onChange={(e) => setEditingCol({ ...editingCol, period: e.target.value })}
                    className="border border-white/15 bg-[#0B0B0D] px-3 py-2 font-mono-tech text-white"
                  />
                </div>

                <input
                  placeholder="封面图片 URL (留空默认取第一张作品)"
                  value={editingCol.coverUrl}
                  onChange={(e) => setEditingCol({ ...editingCol, coverUrl: e.target.value })}
                  className="w-full border border-white/15 bg-[#0B0B0D] px-3 py-2 text-white"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <textarea
                    rows={3}
                    placeholder="中文策展导语"
                    value={editingCol.description}
                    onChange={(e) => setEditingCol({ ...editingCol, description: e.target.value })}
                    className="border border-white/15 bg-[#0B0B0D] p-3 text-white"
                  />
                  <textarea
                    rows={3}
                    placeholder="英文策展导语 (可选)"
                    value={editingCol.descriptionEn}
                    onChange={(e) => setEditingCol({ ...editingCol, descriptionEn: e.target.value })}
                    className="border border-white/15 bg-[#0B0B0D] p-3 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-zinc-400">点击选择收录作品（按点击先后排序，已选 {editingCol.photoIds.length} 幅）：</div>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 max-h-60 overflow-y-auto p-1">
                    {initialPhotos.map((p) => {
                      const orderIdx = editingCol.photoIds.indexOf(p.id);
                      const active = orderIdx >= 0;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            const next = active
                              ? editingCol.photoIds.filter((id) => id !== p.id)
                              : [...editingCol.photoIds, p.id];
                            setEditingCol({ ...editingCol, photoIds: next });
                          }}
                          className={`relative aspect-[3/2] overflow-hidden border text-left ${
                            active ? "border-white ring-1 ring-white" : "border-white/10 opacity-50 hover:opacity-85"
                          }`}
                        >
                          <img src={p.url} alt={p.title} className="h-full w-full object-cover" />
                          {active && (
                            <span className="absolute top-1 left-1 bg-white px-1.5 py-0.5 font-mono-tech text-[10px] font-semibold text-black">
                              {orderIdx + 1}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingCol(null)}
                    className="border border-white/15 px-4 py-2 text-zinc-300"
                  >
                    取消
                  </button>
                  <button type="submit" className="bg-white px-5 py-2 font-medium text-zinc-950">
                    保存影集
                  </button>
                </div>
              </form>
            )}

            <div className="divide-y divide-white/8 border border-white/10 bg-[#121317]">
              {initialCollections.map((col) => (
                <div key={col.id} className="flex items-center justify-between gap-4 p-4 text-xs">
                  <div className="flex items-center gap-4">
                    {col.coverUrl && (
                      <img src={col.coverUrl} alt={col.title} className="h-14 w-22 object-cover bg-zinc-900" />
                    )}
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-white">
                        {col.title} <span className="font-mono-tech text-xs text-zinc-500">/{col.slug}</span>
                      </div>
                      <div className="text-zinc-400">
                        {col.period} · 共 {col.photoCount} 幅作品
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setEditingCol({
                          id: col.id,
                          slug: col.slug,
                          title: col.title,
                          titleEn: col.titleEn,
                          period: col.period,
                          coverUrl: col.coverUrl,
                          description: col.description,
                          descriptionEn: col.descriptionEn,
                          photoIds: col.photos.map((p) => p.id),
                        })
                      }
                      className="border border-white/15 px-3 py-1.5 text-zinc-200 hover:bg-white/10"
                    >
                      编辑与选片
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteCollection(col.id, col.title)}
                      className="border border-white/10 p-1.5 text-zinc-500 hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
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
                <button type="submit" className="bg-white px-5 py-2 font-medium text-zinc-950 shrink-0">
                  添加器材
                </button>
              </div>
            </form>

            <div className="divide-y divide-white/8 border border-white/10 bg-[#121317]">
              {initialGear.map((g) => (
                <div key={g.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono-tech text-[10px] uppercase text-zinc-500">
                        {g.type === "camera" ? "BODY" : "LENS"}
                      </span>
                      <span className="text-sm font-medium text-white">{g.name}</span>
                      <span className="font-mono-tech text-zinc-400">({g.photoCount} 幅关联作品)</span>
                    </div>
                    {g.note && <p className="text-zinc-400">{g.note}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeGearItem(g.id)}
                    className="border border-white/10 p-1.5 text-zinc-500 hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: SITE SETTINGS */}
        {tab === "settings" && (
          <form onSubmit={saveSettings} className="border border-white/10 bg-[#121317] p-6 space-y-5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                ["photographerName", "摄影师署名 (中文)"],
                ["photographerNameEn", "Photographer Name (EN)"],
                ["avatarUrl", "个人头像 URL (如 /samples/avatar.jpg)"],
                ["tagline", "一句话简介 (中文)"],
                ["taglineEn", "Tagline (EN)"],
                ["baseLocation", "常驻城市 (中文)"],
                ["baseLocationEn", "Base Location (EN)"],
                ["email", "联系邮箱"],
                ["instagram", "Instagram 链接"],
                ["xiaohongshu", "小红书主页链接"],
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
                <span className="text-zinc-400">个人自述 (中文)</span>
                <textarea
                  rows={4}
                  value={settingsForm.bio || ""}
                  onChange={(e) => setSettingsForm({ ...settingsForm, bio: e.target.value })}
                  className="w-full border border-white/15 bg-[#0B0B0D] p-3 text-white"
                />
              </label>
              <label className="space-y-1.5 block">
                <span className="text-zinc-400">Biography (EN)</span>
                <textarea
                  rows={4}
                  value={settingsForm.bioEn || ""}
                  onChange={(e) => setSettingsForm({ ...settingsForm, bioEn: e.target.value })}
                  className="w-full border border-white/15 bg-[#0B0B0D] p-3 text-white"
                />
              </label>
            </div>

            <div className="flex justify-end">
              <button type="submit" className="bg-white px-6 py-2.5 font-medium text-zinc-950 hover:bg-zinc-200">
                保存全部设置
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
              <button type="button" onClick={() => setEditingPhoto(null)}>
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
                  className="w-full border border-white/15 bg-[#0B0B0D] px-2.5 py-1.5 font-mono-tech text-white"
                />
              </label>
              <label className="space-y-1">
                <span className="text-zinc-400">地点 (中文)</span>
                <input
                  value={editingPhoto.location}
                  onChange={(e) => setEditingPhoto({ ...editingPhoto, location: e.target.value })}
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

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 font-mono-tech">
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
                className="border border-white/15 px-4 py-2 text-zinc-300"
              >
                取消
              </button>
              <button type="submit" className="bg-white px-5 py-2 font-medium text-zinc-950">
                保存修改
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
