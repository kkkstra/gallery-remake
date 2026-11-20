"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Crop,
  Eye,
  EyeOff,
  ExternalLink,
  Globe,
  GripVertical,
  Home,
  Images,
  KeyRound,
  Layers,
  LayoutGrid,
  Link2,
  LogOut,
  Map as MapIcon,
  MapPin,
  Moon,
  Pencil,
  Plus,
  RefreshCw,
  Rows3,
  Search,
  Settings,
  Sun,
  Terminal,
  Trash2,
  Unlink,
  Upload,
  X,
} from "lucide-react";
import type { GearItem, Photo } from "@/lib/db/schema";
import type { CollectionWithPhotos } from "@/lib/queries";
import {
  buildGroupMap,
  formatNumberedTitle,
  generateGroupId,
} from "@/lib/photo-groups";
import {
  parseMonographBlocks,
  type CoverStyle,
  type MonographBlock,
  type MonographCoverBlock,
} from "@/lib/monograph";
import type { AboutFocusItem, AboutMilestoneItem } from "./AboutClient";
import { extractExifFromBuffer } from "@/lib/exif";
import { AdminHomepageTab } from "./AdminHomepageTab";
import { AdminMapPicker } from "./AdminMapPicker";
import { ImageCropModal } from "./ImageCropModal";
import { optImg } from "@/lib/image-url";
import {
  buildAutoSiteTitle,
  resolveFaviconUrl,
  resolveSiteTitle,
} from "@/lib/site-branding";
import { CameraIllustration, LensIllustration } from "./GearIllustrations";
import { usePreferences } from "./PreferencesProvider";

interface AdminClientProps {
  authenticated: boolean;
  storageMode: "local" | "s3";
  initialPhotos: Photo[];
  initialCollections: CollectionWithPhotos[];
  initialGear: (GearItem & { photoCount: number })[];
  initialSettings: Record<string, string>;
}

const INPUT_CLS =
  "w-full rounded-md border border-[var(--border)] bg-[var(--bg)]/70 px-3 py-1.5 text-base sm:text-xs text-[var(--fg)] placeholder:text-[var(--fg-subtle)] outline-none focus:border-[var(--fg-muted)] transition";

const CATEGORIES = [
  { id: "landscape", label: "自然风光", short: "风光" },
  { id: "street", label: "城市人文", short: "人文" },
  { id: "architecture", label: "建筑空间", short: "建筑" },
  { id: "portrait", label: "人像纪实", short: "人像" },
  { id: "still", label: "静物日常", short: "静物" },
] as const;

const CAT_NAME: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));

async function analyzeImageFile(
  file: File
): Promise<{ width: number; height: number; ambient: string; blurData: string }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth || 1600;
      const height = img.naturalHeight || 1068;
      let ambient = "#1e2024";
      let blurData = "";
      try {
        const scale = Math.min(1, 24 / Math.max(width, height));
        const cw = Math.max(1, Math.round(width * scale));
        const ch = Math.max(1, Math.round(height * scale));
        const c = document.createElement("canvas");
        c.width = cw;
        c.height = ch;
        const ctx = c.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, cw, ch);
          const { data } = ctx.getImageData(0, 0, cw, ch);
          let r = 0, g = 0, b = 0, n = 0;
          for (let i = 0; i < data.length; i += 4) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            n++;
          }
          ambient = `#${[r, g, b]
            .map((v) => Math.round((v / n) * 0.28).toString(16).padStart(2, "0"))
            .join("")}`;
          blurData = c.toDataURL("image/webp", 0.5);
        }
      } catch {
        // ignore
      }
      URL.revokeObjectURL(url);
      resolve({ width, height, ambient, blurData });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ width: 1600, height: 1068, ambient: "#1e2024", blurData: "" });
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
  const { theme, toggleTheme } = usePreferences();

  const [password, setPassword] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [tab, setTab] = useState<"photos" | "homepage" | "collections" | "gear" | "settings">("photos");
  const [toast, setToast] = useState("");

  // Photo Library state
  const [photoList, setPhotoList] = useState<Photo[]>(initialPhotos);
  const [colList, setColList] = useState<CollectionWithPhotos[]>(initialCollections);
  const [searchQuery, setSearchQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState<"all" | "nogps" | "unassigned" | string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>([]);
  const [dragOverPhotoId, setDragOverPhotoId] = useState<number | null>(null);
  const dragInspFrameIdxRef = useRef<number | null>(null);
  const healedDimIdsRef = useRef<Set<number>>(new Set());
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [uploadDrawerOpen, setUploadDrawerOpen] = useState(initialPhotos.length === 0);
  const [uploadSubTab, setUploadSubTab] = useState<"file" | "url">("file");
  const [windowDragging, setWindowDragging] = useState(false);
  const dragPhotoIdxRef = useRef<number | null>(null);

  // Upload queue state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [batchCategory, setBatchCategory] = useState("landscape");
  const [batchHidden, setBatchHidden] = useState(false);
  const [batchColId, setBatchColId] = useState("0");
  const [batchAsGroup, setBatchAsGroup] = useState(false);
  const [batchGroupMeta, setBatchGroupMeta] = useState({
    title: "",
    titleEn: "",
    description: "",
    expanded: false,
  });
  const [showUploadMap, setShowUploadMap] = useState(false);
  const [batchGeo, setBatchGeo] = useState<{
    location: string;
    locationEn: string;
    lat: number | null;
    lng: number | null;
    overrideExif: boolean;
  }>({ location: "", locationEn: "", lat: null, lng: null, overrideExif: false });
  const [extPhoto, setExtPhoto] = useState({
    title: "",
    url: "",
    category: "landscape",
    location: "",
    locationEn: "",
    lat: "" as string | number,
    lng: "" as string | number,
  });

  // Live Right Inspector state
  const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null);
  const [editingColIds, setEditingColIds] = useState<number[]>([]);
  const [showInspectorMap, setShowInspectorMap] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const colEditorRef = useRef<HTMLDivElement>(null);

  // Series & Monograph Workbench state
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const dragBlockIdxRef = useRef<number | null>(null);
  const dragColIdxRef = useRef<number | null>(null);

  // Gear Studio state
  const [editingGear, setEditingGear] = useState<{
    id?: number;
    type: string;
    brand: string;
    name: string;
    specs: string;
    note: string;
    noteEn: string;
  } | null>(null);
  const [syncingGear, setSyncingGear] = useState(false);

  // Site & About Settings state
  const [settingsForm, setSettingsForm] = useState<Record<string, string>>(initialSettings);
  const [focusList, setFocusList] = useState<AboutFocusItem[]>(() =>
    safeParseArray<AboutFocusItem>(initialSettings.aboutFocusJson)
  );
  const [milestoneList, setMilestoneList] = useState<AboutMilestoneItem[]>(() =>
    safeParseArray<AboutMilestoneItem>(initialSettings.aboutMilestonesJson)
  );
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [cropModal, setCropModal] = useState<{
    mode: "avatar" | "favicon";
    src: string;
    revokeOnClose?: boolean;
  } | null>(null);
  const [mergeModal, setMergeModal] = useState<{
    orderedIds: number[];
    metadataFromId: number;
  } | null>(null);
  const [mergingGroup, setMergingGroup] = useState(false);
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const faviconFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPhotoList(initialPhotos);
  }, [initialPhotos]);

  useEffect(() => {
    setColList(initialCollections);
  }, [initialCollections]);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2600);
  }, []);

  // Auto-select first collection when entering Collections tab if nothing open
  useEffect(() => {
    if (tab === "collections" && !editingCol && colList.length > 0) {
      const first = colList[0];
      setEditingCol({
        id: first.id,
        slug: first.slug,
        title: first.title,
        titleEn: first.titleEn,
        period: first.period,
        coverUrl: first.coverUrl,
        description: first.description,
        descriptionEn: first.descriptionEn,
        blocks: parseMonographBlocks(first.blocksJson, first),
      });
    }
  }, [colList, editingCol, tab]);

  // Assigned photo IDs across all collections
  const assignedPhotoIds = useMemo(() => {
    const s = new Set<number>();
    colList.forEach((c) => c.photos.forEach((p) => s.add(p.id)));
    return s;
  }, [colList]);

  // Autocomplete lists for Camera & Lens inputs
  const knownCameras = useMemo(() => {
    const s = new Set<string>();
    initialGear.filter((g) => g.type === "camera").forEach((g) => s.add(g.name));
    photoList.forEach((p) => p.camera && s.add(p.camera));
    return Array.from(s);
  }, [initialGear, photoList]);

  const knownLenses = useMemo(() => {
    const s = new Set<string>();
    initialGear.filter((g) => g.type === "lens").forEach((g) => s.add(g.name));
    photoList.forEach((p) => p.lens && s.add(p.lens));
    return Array.from(s);
  }, [initialGear, photoList]);

  const adminGroupMap = useMemo(() => buildGroupMap(photoList), [photoList]);
  const allAdminGroupIds = useMemo(
    () => Array.from(new Set(Array.from(adminGroupMap.values()).map((g) => g.groupId))),
    [adminGroupMap]
  );
  const groupSeriesCount = allAdminGroupIds.length;
  const expandedGroupSet = useMemo(
    () => new Set(expandedGroupIds.filter((gid) => allAdminGroupIds.includes(gid))),
    [allAdminGroupIds, expandedGroupIds]
  );
  const allGroupsExpanded =
    allAdminGroupIds.length > 0 && expandedGroupSet.size === allAdminGroupIds.length;

  // Filtered photos in Library
  const filteredPhotos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return photoList.filter((p) => {
      if (quickFilter === "hidden" && !p.hidden) return false;
      if (quickFilter === "grouped" && !adminGroupMap.has(p.id)) return false;
      if (quickFilter === "nogps" && p.lat !== null && p.lng !== null) return false;
      if (quickFilter === "unassigned" && assignedPhotoIds.has(p.id)) return false;
      if (
        quickFilter !== "all" &&
        quickFilter !== "hidden" &&
        quickFilter !== "grouped" &&
        quickFilter !== "nogps" &&
        quickFilter !== "unassigned" &&
        p.category !== quickFilter
      ) {
        return false;
      }
      if (!q) return true;
      return [p.title, p.titleEn, p.location, p.locationEn, p.camera, p.lens, p.takenAt]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [adminGroupMap, assignedPhotoIds, photoList, quickFilter, searchQuery]);

  const visibleLibraryPhotos = useMemo(() => {
    if (allAdminGroupIds.length === 0) return filteredPhotos;
    const seenCollapsed = new Set<string>();
    return filteredPhotos.filter((p) => {
      if (!p.groupId || expandedGroupSet.has(p.groupId) || !adminGroupMap.has(p.id)) return true;
      if (seenCollapsed.has(p.groupId)) return false;
      seenCollapsed.add(p.groupId);
      return true;
    });
  }, [adminGroupMap, allAdminGroupIds.length, expandedGroupSet, filteredPhotos]);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (arr.length === 0) return;
      setUploadDrawerOpen(true);
      setUploading(true);

      const isGroupedUpload = batchAsGroup && arr.length >= 2;
      const sharedGroupId = isGroupedUpload ? generateGroupId() : "";
      const fallbackGroupTitle = arr[0].name
        .replace(/\.[^.]+$/, "")
        .replace(/[-_]+/g, " ")
        .replace(/\s+\d+$/, "")
        .trim();
      const groupBaseTitle = batchGroupMeta.title.trim() || fallbackGroupTitle || "未命名组图";

      let done = 0;
      for (const file of arr) {
        done += 1;
        setUploadProgress(`正在上传并解析 EXIF (${done}/${arr.length}) · ${file.name}`);
        const meta = await analyzeImageFile(file);

        // When S3/R2 is active, try direct browser-to-R2 presigned PUT first (bypasses Vercel 4.5MB limit for 50MB+ photos!)
        let uploadedViaPresign = false;
        if (storageMode === "s3") {
          try {
            const preRes = await fetch("/api/admin/presign", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ filename: file.name, contentType: file.type || "image/jpeg" }),
            });
            if (preRes.ok) {
              const { uploadUrl, publicUrl } = await preRes.json();
              const putRes = await fetch(uploadUrl, {
                method: "PUT",
                headers: { "Content-Type": file.type || "image/jpeg" },
                body: file,
              });
              if (putRes.ok) {
                const ab = await file.arrayBuffer();
                const exif = extractExifFromBuffer(ab);
                const rawTitle = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
                const finalLat =
                  batchGeo.overrideExif && batchGeo.lat !== null ? batchGeo.lat : exif.lat ?? batchGeo.lat;
                const finalLng =
                  batchGeo.overrideExif && batchGeo.lng !== null ? batchGeo.lng : exif.lng ?? batchGeo.lng;
                await fetch("/api/admin/photos", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    title: isGroupedUpload ? groupBaseTitle : rawTitle || "未命名作品",
                    titleEn: isGroupedUpload ? batchGroupMeta.titleEn.trim() : "",
                    description: isGroupedUpload ? batchGroupMeta.description.trim() : "",
                    url: publicUrl,
                    width: exif.width || meta.width,
                    height: exif.height || meta.height,
                    ambient: meta.ambient,
                    blurData: meta.blurData,
                    category: batchCategory,
                    hidden: batchHidden,
                    groupId: sharedGroupId,
                    groupOrder: isGroupedUpload ? done : 0,
                    groupExpanded: isGroupedUpload ? batchGroupMeta.expanded : false,
                    takenAt: exif.takenAt,
                    location: batchGeo.location,
                    locationEn: batchGeo.locationEn,
                    lat: finalLat,
                    lng: finalLng,
                    camera: exif.camera,
                    lens: exif.lens,
                    focalMm: exif.focalMm,
                    aperture: exif.aperture,
                    shutter: exif.shutter,
                    iso: exif.iso,
                    collectionIds: Number(batchColId) > 0 ? [Number(batchColId)] : [],
                  }),
                });
                uploadedViaPresign = true;
              }
            }
          } catch {
            // Fall back to server multipart upload if R2 bucket CORS is not set yet
          }
        }

        if (!uploadedViaPresign) {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("width", String(meta.width));
          fd.append("height", String(meta.height));
          fd.append("ambient", meta.ambient);
          fd.append("category", batchCategory);
          fd.append("hidden", String(batchHidden));
          if (isGroupedUpload) {
            fd.append("title", groupBaseTitle);
            if (batchGroupMeta.titleEn.trim()) fd.append("titleEn", batchGroupMeta.titleEn.trim());
            if (batchGroupMeta.description.trim()) fd.append("description", batchGroupMeta.description.trim());
            fd.append("groupId", sharedGroupId);
            fd.append("groupOrder", String(done));
            fd.append("groupExpanded", String(batchGroupMeta.expanded));
          }
          if (batchGeo.location) fd.append("location", batchGeo.location);
          if (batchGeo.locationEn) fd.append("locationEn", batchGeo.locationEn);
          if (batchGeo.lat !== null) fd.append("lat", String(batchGeo.lat));
          if (batchGeo.lng !== null) fd.append("lng", String(batchGeo.lng));
          if (batchGeo.overrideExif) fd.append("overrideExif", "true");
          if (Number(batchColId) > 0) fd.append("collectionId", batchColId);
          await fetch("/api/admin/upload", { method: "POST", body: fd });
        }
      }
      setUploading(false);
      setUploadProgress("");
      notify(isGroupedUpload ? `已上传并生成组图（共 ${arr.length} 幅）` : `已成功上传 ${arr.length} 幅作品`);
      router.refresh();
    },
    [
      batchAsGroup,
      batchCategory,
      batchColId,
      batchGeo,
      batchGroupMeta,
      batchHidden,
      notify,
      router,
      storageMode,
    ]
  );

  // Global window file drag-and-drop listener
  useEffect(() => {
    if (!authenticated) return;
    let dragDepth = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types || []).includes("Files");
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth += 1;
      setWindowDragging(true);
    };
    const onOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) setWindowDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth = 0;
      setWindowDragging(false);
      if (e.dataTransfer?.files?.length) {
        setTab("photos");
        handleFiles(e.dataTransfer.files);
      }
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [authenticated, handleFiles]);

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
        setLoginErr(data.error || "口令错误");
        return;
      }
      router.refresh();
    };

    return (
      <div className="min-h-dvh flex items-center justify-center px-4">
        <form onSubmit={handleLogin} className="surface-card w-full max-w-sm rounded-xl p-7 space-y-5">
          <div className="space-y-1">
            <h1 className="text-lg font-semibold text-[var(--fg)]">工作台登录</h1>
            <p className="text-xs text-[var(--fg-muted)]">
              输入管理口令进入作品、专题画册与全站设置管理
            </p>
          </div>

          <div className="space-y-2">
            <input
              type="password"
              required
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="输入管理口令"
              className={INPUT_CLS}
            />
            {loginErr && <p className="text-xs text-red-400">{loginErr}</p>}
          </div>

          <div className="flex items-center justify-between pt-1">
            <Link href="/" className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] transition">
              ← 返回前台
            </Link>
            <button
              type="submit"
              className="rounded-md bg-[var(--fg)] px-4 py-2 text-xs font-medium text-[var(--bg)] hover:opacity-90 transition cursor-pointer"
            >
              进入工作台
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

  const selectInspectorPhoto = (photo: Photo) => {
    setEditingPhoto({ ...photo });
    setEditingColIds(colList.filter((c) => c.photos.some((p) => p.id === photo.id)).map((c) => c.id));
  };

  const stepInspector = (dir: -1 | 1) => {
    if (!editingPhoto || filteredPhotos.length <= 1) return;
    const idx = filteredPhotos.findIndex((p) => p.id === editingPhoto.id);
    const next = filteredPhotos[(idx + dir + filteredPhotos.length) % filteredPhotos.length];
    if (next) selectInspectorPhoto(next);
  };

  const saveInspectorPhoto = async (advanceNext = false) => {
    if (!editingPhoto) return;
    setSavingPhoto(true);
    const res = await fetch(`/api/admin/photos/${editingPhoto.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...editingPhoto, collectionIds: editingColIds }),
    });
    const data = await res.json().catch(() => ({}));
    if (Array.isArray(data.groupPhotos) && data.groupPhotos.length > 0) {
      const updatedMap = new Map<number, Photo>(data.groupPhotos.map((gp: Photo) => [gp.id, gp]));
      setPhotoList((prev) => prev.map((p) => updatedMap.get(p.id) ?? p));
      if (data.photo) setEditingPhoto(data.photo);
    } else {
      setPhotoList((prev) => prev.map((p) => (p.id === editingPhoto.id ? data.photo ?? editingPhoto : p)));
    }
    setSavingPhoto(false);
    notify(editingPhoto.groupId ? "已同步保存整组作品信息" : "已保存作品修改");
    router.refresh();
    if (advanceNext) stepInspector(1);
  };

  const resolveCityGeocode = async (
    query: string,
    onResolved: (res: { lat: number; lng: number; location: string; locationEn: string }) => void
  ) => {
    if (!query.trim()) {
      notify("请先输入城市或地点名称");
      return;
    }
    setGeocoding(true);
    try {
      const r = await fetch(`/api/admin/geocode?q=${encodeURIComponent(query.trim())}`);
      const data = await r.json();
      if (!r.ok) notify(data.error || "未能识别坐标");
      else {
        onResolved(data);
        notify(`已定位：${data.lat}, ${data.lng}`);
      }
    } catch {
      notify("坐标解析失败");
    } finally {
      setGeocoding(false);
    }
  };

  const healPhotoDimensionsIfSwapped = (photo: Photo, el: HTMLImageElement) => {
    const nw = el.naturalWidth;
    const nh = el.naturalHeight;
    if (!nw || !nh || healedDimIdsRef.current.has(photo.id)) return;
    const orientSwapped = (nw > nh) !== ((photo.width || 1600) > (photo.height || 1068));
    if (!orientSwapped) return;
    healedDimIdsRef.current.add(photo.id);
    const isDefaultPlaceholder = photo.width === 1600 && photo.height === 1068;
    const trueW = isDefaultPlaceholder ? nw : photo.height;
    const trueH = isDefaultPlaceholder ? nh : photo.width;
    setPhotoList((prev) =>
      prev.map((p) => (p.id === photo.id ? { ...p, width: trueW, height: trueH } : p))
    );
    if (editingPhoto?.id === photo.id) {
      setEditingPhoto((prev) => (prev && prev.id === photo.id ? { ...prev, width: trueW, height: trueH } : prev));
    }
    fetch(`/api/admin/photos/${photo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ width: trueW, height: trueH }),
    }).catch(() => {});
  };

  const handleAddExternal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extPhoto.url || !extPhoto.title) return;
    const probed = await new Promise<{ width?: number; height?: number }>((resolve) => {
      const img = new Image();
      const timer = setTimeout(() => resolve({}), 2500);
      img.onload = () => {
        clearTimeout(timer);
        resolve({
          width: img.naturalWidth || undefined,
          height: img.naturalHeight || undefined,
        });
      };
      img.onerror = () => {
        clearTimeout(timer);
        resolve({});
      };
      img.src = extPhoto.url;
    });
    const res = await fetch("/api/admin/photos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...extPhoto,
        ...probed,
        hidden: batchHidden,
        collectionIds: Number(batchColId) > 0 ? [Number(batchColId)] : [],
      }),
    });
    if (res.ok) {
      setExtPhoto({ title: "", url: "", category: "landscape", location: "", locationEn: "", lat: "", lng: "" });
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
    notify("作品顺序已更新");
    router.refresh();
  };

  const partitionContiguousBlocks = (list: Photo[]): Photo[][] => {
    const blocks: Photo[][] = [];
    const seenGroups = new Set<string>();
    for (const p of list) {
      const g = adminGroupMap.get(p.id);
      if (!g) {
        blocks.push([p]);
      } else if (!seenGroups.has(g.groupId)) {
        seenGroups.add(g.groupId);
        blocks.push(g.siblings);
      }
    }
    return blocks;
  };

  const movePhotoBy = (photoId: number, dir: -1 | 1, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const blocks = partitionContiguousBlocks(photoList);
    const bIdx = blocks.findIndex((b) => b.some((p) => p.id === photoId));
    const targetIdx = bIdx + dir;
    if (bIdx < 0 || targetIdx < 0 || targetIdx >= blocks.length) return;
    [blocks[bIdx], blocks[targetIdx]] = [blocks[targetIdx], blocks[bIdx]];
    persistPhotoOrder(blocks.flat());
  };

  const moveBlockToTop = (photoId: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const blocks = partitionContiguousBlocks(photoList);
    const bIdx = blocks.findIndex((b) => b.some((p) => p.id === photoId));
    if (bIdx <= 0) return;
    const [block] = blocks.splice(bIdx, 1);
    blocks.unshift(block);
    persistPhotoOrder(blocks.flat());
  };

  const toggleSingleGroupExpand = (groupId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((g) => g !== groupId) : [...prev, groupId]
    );
  };

  const applyGroupOrderOptimistic = async (reorderedSiblings: Photo[], focusId?: number) => {
    if (reorderedSiblings.length < 2) return;
    const gid = reorderedSiblings[0].groupId;
    const updatedSibs = reorderedSiblings.map((s, idx) => ({ ...s, groupOrder: idx + 1 }));
    setPhotoList((prev) => {
      const out: Photo[] = [];
      let inserted = false;
      for (const p of prev) {
        if (p.groupId === gid) {
          if (!inserted) {
            out.push(...updatedSibs);
            inserted = true;
          }
        } else {
          out.push(p);
        }
      }
      return out;
    });
    if (focusId) {
      const f = updatedSibs.find((s) => s.id === focusId);
      if (f) setEditingPhoto({ ...f });
    }
    await fetch("/api/admin/photos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "group_reorder", ids: updatedSibs.map((s) => s.id) }),
    });
    notify("组内顺序已更新");
    router.refresh();
  };

  const handleLibraryPhotoDrop = async (fromIdx: number, toIdx: number) => {
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
    const moved = photoList[fromIdx];
    const target = photoList[toIdx];
    if (!moved || !target) return;

    const movedGroup = adminGroupMap.get(moved.id);
    if (movedGroup && moved.groupId === target.groupId) {
      const sibs = [...movedGroup.siblings];
      const f = sibs.findIndex((s) => s.id === moved.id);
      const t = sibs.findIndex((s) => s.id === target.id);
      if (f < 0 || t < 0 || f === t) return;
      const [item] = sibs.splice(f, 1);
      sibs.splice(t, 0, item);
      await applyGroupOrderOptimistic(sibs, moved.id);
      return;
    }

    const blocks = partitionContiguousBlocks(photoList);
    const fromBlockIdx = blocks.findIndex((b) => b.some((p) => p.id === moved.id));
    const toBlockIdx = blocks.findIndex((b) => b.some((p) => p.id === target.id));
    if (fromBlockIdx < 0 || toBlockIdx < 0 || fromBlockIdx === toBlockIdx) return;
    const [block] = blocks.splice(fromBlockIdx, 1);
    blocks.splice(toBlockIdx, 0, block);
    persistPhotoOrder(blocks.flat());
  };

  const openMergeGroupModal = () => {
    const byId = new Map(photoList.map((p) => [p.id, p]));
    const ordered: Photo[] = [];
    const seen = new Set<number>();
    const touchedGroups = new Set<string>();

    for (const id of selectedIds) {
      const p = byId.get(id);
      if (p && !seen.has(p.id)) {
        ordered.push(p);
        seen.add(p.id);
        if (p.groupId) touchedGroups.add(p.groupId);
      }
    }
    for (const p of photoList) {
      if (p.groupId && touchedGroups.has(p.groupId) && !seen.has(p.id)) {
        ordered.push(p);
        seen.add(p.id);
      }
    }

    if (ordered.length < 2) {
      notify("请至少选择 2 幅作品合并为组图");
      return;
    }

    const richest =
      ordered.find((p) => p.description.trim() && p.location.trim()) ||
      ordered.find((p) => p.description.trim()) ||
      ordered[0];

    setMergeModal({
      orderedIds: ordered.map((p) => p.id),
      metadataFromId: richest.id,
    });
  };

  const confirmMergeGroup = async () => {
    if (!mergeModal) return;
    setMergingGroup(true);
    const res = await fetch("/api/admin/photos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "group_merge",
        ids: mergeModal.orderedIds,
        metadataFromId: mergeModal.metadataFromId,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setMergingGroup(false);
    if (!res.ok) {
      notify(data.error || "合并组图失败");
      return;
    }
    const sourcePhoto = photoList.find((p) => p.id === mergeModal.metadataFromId);
    setMergeModal(null);
    setSelectedIds([]);
    const freshRes = await fetch("/api/admin/photos");
    if (freshRes.ok) {
      const freshData = await freshRes.json();
      if (Array.isArray(freshData.photos)) {
        setPhotoList(freshData.photos);
        const firstMerged = freshData.photos.find(
          (p: Photo) => p.groupId === data.groupId && p.groupOrder === 1
        );
        if (firstMerged) selectInspectorPhoto(firstMerged);
      }
    }
    notify(
      `已合并为组图（共 ${data.count} 幅，保留《${sourcePhoto?.title || "所选作品"}》的标题与描述）`
    );
    router.refresh();
  };

  const toggleHidden = async (photo: Photo, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const nextVal = !photo.hidden;
    setPhotoList((prev) => prev.map((p) => (p.id === photo.id ? { ...p, hidden: nextVal } : p)));
    if (editingPhoto?.id === photo.id) setEditingPhoto({ ...editingPhoto, hidden: nextVal });
    await fetch(`/api/admin/photos/${photo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hidden: nextVal }),
    });
    notify(nextVal ? "已隐藏该作品（前台不可见）" : "已恢复公开展示");
    router.refresh();
  };

  const deletePhoto = async (photo: Photo) => {
    if (!confirm(`确认删除《${photo.title}》？`)) return;
    await fetch(`/api/admin/photos/${photo.id}`, { method: "DELETE" });
    setSelectedIds((prev) => prev.filter((id) => id !== photo.id));
    if (editingPhoto?.id === photo.id) setEditingPhoto(null);
    notify("已删除作品");
    router.refresh();
  };

  const runBatchAction = async (
    action:
      | "category"
      | "hidden"
      | "collection"
      | "delete"
      | "group_merge"
      | "group_ungroup",
    value?: string | boolean | number
  ) => {
    if (selectedIds.length === 0) return;
    if (action === "delete" && !confirm(`确认删除选中的 ${selectedIds.length} 幅作品？`)) return;
    const res = await fetch("/api/admin/photos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds, action, value }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      notify(data.error || "批量操作失败");
      return;
    }
    if (action === "delete" || action === "group_merge" || action === "group_ungroup") {
      setSelectedIds([]);
    }
    if (action === "group_merge") {
      const freshRes = await fetch("/api/admin/photos");
      if (freshRes.ok) {
        const freshData = await freshRes.json();
        if (Array.isArray(freshData.photos)) {
          setPhotoList(freshData.photos);
          const firstMerged = freshData.photos.find(
            (p: Photo) => p.groupId === data.groupId && p.groupOrder === 1
          );
          if (firstMerged) selectInspectorPhoto(firstMerged);
        }
      }
      notify(`已合并为组图（共 ${data.count} 幅，共用第 1 幅标题与地点）`);
    } else if (action === "group_ungroup") {
      const freshRes = await fetch("/api/admin/photos");
      if (freshRes.ok) {
        const freshData = await freshRes.json();
        if (Array.isArray(freshData.photos)) setPhotoList(freshData.photos);
      }
      if (editingPhoto) setEditingPhoto({ ...editingPhoto, groupId: "", groupOrder: 0, groupExpanded: false });
      notify("已解散所选组图");
    } else {
      notify(`已批量处理 ${selectedIds.length} 幅作品`);
    }
    router.refresh();
  };

  const refreshAdminPhotos = async (focusPhotoId?: number) => {
    const r = await fetch("/api/admin/photos");
    if (!r.ok) return;
    const d = await r.json();
    if (Array.isArray(d.photos)) {
      setPhotoList(d.photos);
      const nextFocusId = focusPhotoId ?? editingPhoto?.id;
      if (nextFocusId) {
        const found = d.photos.find((p: Photo) => p.id === nextFocusId);
        if (found) setEditingPhoto({ ...found });
      }
    }
    router.refresh();
  };

  const reorderGroupFrame = async (siblings: Photo[], currId: number, dir: -1 | 1) => {
    const idx = siblings.findIndex((s) => s.id === currId);
    const nextIdx = idx + dir;
    if (idx < 0 || nextIdx < 0 || nextIdx >= siblings.length) return;
    const reordered = [...siblings];
    [reordered[idx], reordered[nextIdx]] = [reordered[nextIdx], reordered[idx]];
    await applyGroupOrderOptimistic(reordered, currId);
  };

  const detachFrameFromGroup = async (photoId: number) => {
    await fetch("/api/admin/photos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "group_remove", ids: [photoId] }),
    });
    await refreshAdminPhotos(photoId);
    notify("已将该照片移出组图");
  };

  const dissolveGroup = async (groupId: string) => {
    if (!confirm("确认解散该组图？解散后各张照片仍保留当前标题、地点与描述。")) return;
    await fetch("/api/admin/photos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "group_ungroup", groupId }),
    });
    await refreshAdminPhotos(editingPhoto?.id);
    notify("已解散组图");
  };

  // Series & Monograph handlers
  const openCollectionEditor = (col?: CollectionWithPhotos) => {
    if (!col) {
      setEditingCol({
        slug: "",
        title: "",
        titleEn: "",
        period: String(new Date().getFullYear()),
        coverUrl: photoList[0]?.url || "",
        description: "",
        descriptionEn: "",
        blocks: [
          {
            id: `cov-${Date.now()}`,
            kind: "cover",
            style: "full",
            imageUrl: photoList[0]?.url || "",
            eyebrow: String(new Date().getFullYear()),
            eyebrowEn: String(new Date().getFullYear()),
            title: "",
            titleEn: "",
            body: "",
            bodyEn: "",
          },
        ],
      });
      setPickerOpen(true);
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
    setPickerOpen(false);
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setTimeout(() => colEditorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    }
  };

  const persistCollectionOrder = async (nextCols: CollectionWithPhotos[]) => {
    setColList(nextCols);
    await fetch("/api/admin/collections", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: nextCols.map((c) => c.id) }),
    });
    notify("影集展示顺序已更新");
    router.refresh();
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

  const insertCoverBlockAt = (insertIdx?: number) => {
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
    const next = [...editingCol.blocks];
    if (insertIdx === undefined) next.push(newBlock);
    else next.splice(insertIdx, 0, newBlock);
    setEditingCol({ ...editingCol, blocks: next });
  };

  const updateBlockAt = (idx: number, patch: Partial<MonographBlock>) => {
    if (!editingCol) return;
    setEditingCol({
      ...editingCol,
      blocks: editingCol.blocks.map((b, i) => (i === idx ? ({ ...b, ...patch } as MonographBlock) : b)),
    });
  };

  const moveBlock = (idx: number, dir: -1 | 1) => {
    if (!editingCol) return;
    const target = idx + dir;
    if (target < 0 || target >= editingCol.blocks.length) return;
    const next = [...editingCol.blocks];
    [next[idx], next[target]] = [next[target], next[idx]];
    setEditingCol({ ...editingCol, blocks: next });
  };

  const saveCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCol) return;
    const orderedPhotoIds = editingCol.blocks
      .filter((b): b is Extract<MonographBlock, { kind: "photo" }> => b.kind === "photo")
      .map((b) => b.photoId);

    const normalizedBlocks = editingCol.blocks.map((b, idx) =>
      b.kind === "cover" && idx === 0
        ? {
            ...b,
            title: b.title || editingCol.title,
            titleEn: b.titleEn || editingCol.titleEn,
            body: b.body || editingCol.description,
            bodyEn: b.bodyEn || editingCol.descriptionEn,
            imageUrl: b.imageUrl || editingCol.coverUrl,
          }
        : b
    );

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
        coverUrl: editingCol.coverUrl || photoMap.get(orderedPhotoIds[0])?.url || "",
        description: editingCol.description,
        descriptionEn: editingCol.descriptionEn,
        photoIds: orderedPhotoIds,
        blocksJson: JSON.stringify(normalizedBlocks),
      }),
    });
    if (res.ok) {
      notify("影集与画册编排已保存");
      router.refresh();
    } else {
      const err = await res.json().catch(() => ({}));
      notify(err.error || "保存失败");
    }
  };

  const deleteCollection = async (id: number, title: string) => {
    if (!confirm(`确认删除影集《${title}》？（不会删除原照片）`)) return;
    await fetch(`/api/admin/collections/${id}`, { method: "DELETE" });
    if (editingCol?.id === id) setEditingCol(null);
    notify("已删除影集");
    router.refresh();
  };

  // Gear handlers + 1-click EXIF Sync
  const saveGearForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGear || !editingGear.name.trim()) return;
    const method = editingGear.id ? "PATCH" : "POST";
    await fetch("/api/admin/gear", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingGear),
    });
    setEditingGear(null);
    notify(editingGear.id ? "器材信息已更新" : "已新增器材");
    router.refresh();
  };

  const syncGearFromExif = async () => {
    setSyncingGear(true);
    const res = await fetch("/api/admin/gear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync_from_exif" }),
    });
    const data = res.ok
      ? ((await res.json()) as { importedCount?: number; createdCount?: number })
      : {};
    setSyncingGear(false);
    const count = data.importedCount ?? data.createdCount ?? 0;
    notify(count > 0 ? `已从 EXIF 自动导入 ${count} 款新器材` : "当前所有照片器材均已在库中");
    if (count > 0) router.refresh();
  };

  const moveGearItem = async (id: number, dir: -1 | 1, typeItems: (GearItem & { photoCount: number })[]) => {
    const idx = typeItems.findIndex((g) => g.id === id);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= typeItems.length) return;
    const reordered = [...typeItems];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    const otherIds = initialGear.filter((g) => g.type !== typeItems[0]?.type).map((g) => g.id);
    const orderedIds =
      typeItems[0]?.type === "camera"
        ? [...reordered.map((g) => g.id), ...otherIds]
        : [...otherIds, ...reordered.map((g) => g.id)];
    await fetch("/api/admin/gear", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds }),
    });
    router.refresh();
  };

  const removeGearItem = async (id: number) => {
    await fetch(`/api/admin/gear?id=${id}`, { method: "DELETE" });
    notify("已移除器材");
    router.refresh();
  };

  const syncDocumentBranding = (next: Record<string, string>) => {
    if (typeof document === "undefined") return;
    document.title = resolveSiteTitle(next);
    const href = resolveFaviconUrl(next);
    let iconLink = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!iconLink) {
      iconLink = document.createElement("link");
      iconLink.rel = "icon";
      document.head.appendChild(iconLink);
    }
    iconLink.href = href;
  };

  const closeCropModal = () => {
    setCropModal((prev) => {
      if (prev?.revokeOnClose) URL.revokeObjectURL(prev.src);
      return null;
    });
  };

  const openLocalFileCrop = (mode: "avatar" | "favicon", file?: File | null) => {
    if (!file) return;
    const objUrl = URL.createObjectURL(file);
    setCropModal({ mode, src: objUrl, revokeOnClose: true });
  };

  const applyCroppedBrandImage = async (blob: Blob, filename: string) => {
    if (!cropModal) return;
    const fd = new FormData();
    fd.append("file", new File([blob], filename, { type: blob.type }));
    const upRes = await fetch("/api/admin/asset", { method: "POST", body: fd });
    if (!upRes.ok) {
      notify("图片上传失败，请重试");
      return;
    }
    const { url } = (await upRes.json()) as { url: string };
    const field = cropModal.mode === "favicon" ? "faviconUrl" : "avatarUrl";
    const next = { ...settingsForm, [field]: url };
    setSettingsForm(next);
    await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: url }),
    });
    syncDocumentBranding(next);
    closeCropModal();
    notify(cropModal.mode === "favicon" ? "网站图标已裁剪并直接生效" : "头像已裁剪并直接生效");
    router.refresh();
  };

  const resetDefaultFavicon = async () => {
    const next = { ...settingsForm, faviconUrl: "" };
    setSettingsForm(next);
    await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ faviconUrl: "" }),
    });
    syncDocumentBranding(next);
    notify("已恢复默认镜头网站图标");
    router.refresh();
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...settingsForm,
        aboutFocusJson: JSON.stringify(focusList),
        aboutMilestonesJson: JSON.stringify(milestoneList),
      }),
    });
    syncDocumentBranding(settingsForm);
    setSettingsDirty(false);
    notify("站点与关于页配置已保存");
    router.refresh();
  };

  const generateAndSaveApiKey = async () => {
    const bytes = new Uint8Array(20);
    crypto.getRandomValues(bytes);
    const key = `gk_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
    const nextSettings = { ...settingsForm, apiKey: key };
    setSettingsForm(nextSettings);
    await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: key }),
    });
    notify("已生成并立即启用新 API 密钥");
    router.refresh();
  };

  const photoMap = new Map(photoList.map((p) => [p.id, p]));
  const hiddenCount = photoList.filter((p) => p.hidden).length;
  const noGpsCount = photoList.filter((p) => p.lat === null || p.lng === null).length;
  const unassignedCount = photoList.filter((p) => !assignedPhotoIds.has(p.id)).length;

  return (
    <div className="min-h-dvh flex flex-col text-[var(--fg)]">
      {/* Global Drag-Anywhere Upload Overlay */}
      {windowDragging && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-md p-6 pointer-events-none">
          <div className="surface-card flex flex-col items-center gap-3 rounded-2xl px-12 py-10 text-center">
            <Upload className="h-8 w-8 text-[var(--fg)]" />
            <div className="text-lg font-semibold">松开鼠标即可批量上传作品</div>
            <p className="text-xs text-[var(--fg-muted)]">自动提取机身、镜头、曝光参数、GPS 坐标与柔焦显影图</p>
          </div>
        </div>
      )}

      {/* Datalists for Instant Camera & Lens Autocomplete */}
      <datalist id="known-cameras">
        {knownCameras.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <datalist id="known-lenses">
        {knownLenses.map((l) => (
          <option key={l} value={l} />
        ))}
      </datalist>

      {/* Top Studio Workbench Bar */}
      <header className="sticky top-0 z-30 header-material border-b border-[var(--border)]">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-2.5 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-3">
          <div className="flex items-center justify-between sm:justify-start gap-4 sm:gap-8">
            <span className="text-sm sm:text-base font-semibold tracking-wide shrink-0">
              {settingsForm.photographerName || "林远"} · 工作台
            </span>

            {/* Mobile Top-Right Quick Actions */}
            <div className="flex sm:hidden items-center gap-2 text-xs text-[var(--fg-muted)]">
              <button
                type="button"
                onClick={toggleTheme}
                title="切换深浅主题"
                className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-[var(--bg-subtle)] hover:text-[var(--fg)] transition cursor-pointer"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <Link
                href="/"
                target="_blank"
                className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[var(--fg)]"
              >
                <span>前台</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                aria-label="退出"
                className="p-1 text-[var(--fg-muted)] hover:text-[var(--fg)] cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>

            <nav className="hidden sm:flex items-center gap-1 rounded-lg bg-[var(--bg-subtle)] p-1 text-xs">
              {(
                [
                  ["photos", Images, "作品库", photoList.length],
                  ["homepage", Home, "首页编排", null],
                  ["collections", Layers, "专题画册", colList.length],
                  ["gear", Camera, "器材档案", initialGear.length],
                  ["settings", Settings, "站点与关于", null],
                ] as const
              ).map(([key, Icon, label, count]) => {
                const active = tab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 font-medium transition cursor-pointer ${
                      active
                        ? "bg-[var(--fg)] text-[var(--bg)] shadow-xs"
                        : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{label}</span>
                    {count !== null && (
                      <span className={`text-[11px] ${active ? "opacity-75" : "opacity-60"}`}>{count}</span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Mobile Dedicated Full-Width 5-Tab Bar */}
          <nav className="grid sm:hidden grid-cols-5 gap-1 rounded-lg bg-[var(--bg-subtle)] p-1 text-xs">
            {(
              [
                ["photos", Images, "作品", photoList.length],
                ["homepage", Home, "首页", null],
                ["collections", Layers, "画册", colList.length],
                ["gear", Camera, "器材", initialGear.length],
                ["settings", Settings, "设置", null],
              ] as const
            ).map(([key, Icon, label, count]) => {
              const active = tab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`flex items-center justify-center gap-1 rounded-md py-1.5 font-medium transition cursor-pointer ${
                    active
                      ? "bg-[var(--fg)] text-[var(--bg)] shadow-xs"
                      : "text-[var(--fg-muted)]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{label}</span>
                  {count !== null && (
                    <span className={`text-[10px] ${active ? "opacity-75" : "opacity-60"}`}>{count}</span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="hidden sm:flex items-center gap-3 text-xs text-[var(--fg-muted)]">
            <span className="hidden lg:inline rounded-full border border-[var(--border)] px-2.5 py-0.5 text-[11px]">
              {storageMode === "s3" ? "S3 云端存储" : "本地存储"}
            </span>
            <button
              type="button"
              onClick={toggleTheme}
              title="切换深浅主题"
              className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-[var(--bg-subtle)] hover:text-[var(--fg)] transition cursor-pointer"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link
              href="/"
              target="_blank"
              className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2.5 py-1 text-[var(--fg)] hover:bg-[var(--bg-subtle)] transition"
            >
              <span>查看前台</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1 hover:text-[var(--fg)] transition cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">退出</span>
            </button>
          </div>
        </div>
      </header>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-[80] surface-card flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-medium text-[var(--fg)] animate-tab-in">
          <Check className="h-3.5 w-3.5 text-emerald-500" />
          <span>{toast}</span>
        </div>
      )}

      {/* ==================== TAB 1: PHOTO LIBRARY + RIGHT INSPECTOR ==================== */}
      {tab === "photos" && (
        <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 pt-5 pb-24 sm:px-7 space-y-4">
          {/* Toolbar: Search + Smart Filters + Upload Toggle + Grid/List */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative w-full sm:w-60">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--fg-subtle)]" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索标题、城市、器材…"
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-subtle)] pl-8 pr-7 py-1.5 text-base sm:text-xs text-[var(--fg)] placeholder:text-[var(--fg-subtle)] outline-none focus:border-[var(--fg-muted)]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--fg-muted)] cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar text-xs py-0.5">
                {(
                  [
                    ["all", `全部 ${photoList.length}`],
                    ...(groupSeriesCount > 0 || quickFilter === "grouped"
                      ? [["grouped", `组图 ${groupSeriesCount}`]]
                      : []),
                    ...(hiddenCount > 0 || quickFilter === "hidden" ? [["hidden", `已隐藏 ${hiddenCount}`]] : []),
                    ...(noGpsCount > 0 ? [["nogps", `缺定位 ${noGpsCount}`]] : []),
                    ...(unassignedCount > 0 ? [["unassigned", `未入集 ${unassignedCount}`]] : []),
                    ...CATEGORIES.map((c) => {
                      const cnt = photoList.filter((p) => p.category === c.id).length;
                      return cnt > 0 ? [c.id, `${c.short} ${cnt}`] : null;
                    }).filter((x): x is [string, string] => Boolean(x)),
                  ] as [string, string][]
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setQuickFilter(quickFilter === id && id !== "all" ? "all" : id)}
                    className={`whitespace-nowrap rounded-md px-2.5 py-1 transition cursor-pointer ${
                      quickFilter === id
                        ? "bg-[var(--fg)] text-[var(--bg)] font-medium"
                        : "border border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {allAdminGroupIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setExpandedGroupIds(allGroupsExpanded ? [] : allAdminGroupIds)}
                  title={allGroupsExpanded ? "收起全部组图（收起后可整组整体移动）" : "展开全部组图"}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                    allGroupsExpanded
                      ? "border-[var(--fg)] bg-[var(--bg-subtle)] text-[var(--fg)]"
                      : "border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)]"
                  }`}
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>{allGroupsExpanded ? "收起组图" : "展开组图"}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setUploadDrawerOpen((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                  uploadDrawerOpen
                    ? "border border-[var(--fg)] text-[var(--fg)]"
                    : "bg-[var(--fg)] text-[var(--bg)] hover:opacity-90"
                }`}
              >
                <Upload className="h-3.5 w-3.5" />
                <span>{uploadDrawerOpen ? "收起上传栏" : "上传作品"}</span>
              </button>

              <div className="flex items-center rounded-md border border-[var(--border)] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  title="卡片网格"
                  className={`p-1.5 cursor-pointer ${
                    viewMode === "grid" ? "bg-[var(--fg)] text-[var(--bg)]" : "text-[var(--fg-muted)]"
                  }`}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  title="紧凑列表"
                  className={`p-1.5 cursor-pointer ${
                    viewMode === "list" ? "bg-[var(--fg)] text-[var(--bg)]" : "text-[var(--fg-muted)]"
                  }`}
                >
                  <Rows3 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Collapsible Upload & External URL Drawer */}
          {uploadDrawerOpen && (
            <section className="surface-card rounded-xl p-4 sm:p-5 space-y-4 text-xs animate-tab-in">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setUploadSubTab("file")}
                    className={`inline-flex items-center gap-1.5 pb-1 font-medium cursor-pointer ${
                      uploadSubTab === "file"
                        ? "border-b-2 border-[var(--fg)] text-[var(--fg)]"
                        : "text-[var(--fg-muted)]"
                    }`}
                  >
                    <Upload className="h-3.5 w-3.5" /> 本地批量上传
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadSubTab("url")}
                    className={`inline-flex items-center gap-1.5 pb-1 font-medium cursor-pointer ${
                      uploadSubTab === "url"
                        ? "border-b-2 border-[var(--fg)] text-[var(--fg)]"
                        : "text-[var(--fg-muted)]"
                    }`}
                  >
                    <Link2 className="h-3.5 w-3.5" /> 外链图片地址
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-[var(--fg-muted)]">
                  <label className="inline-flex items-center gap-1.5">
                    <span>默认分类</span>
                    <select
                      value={batchCategory}
                      onChange={(e) => setBatchCategory(e.target.value)}
                      className="rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-[var(--fg)]"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="inline-flex items-center gap-1.5">
                    <span>归入影集</span>
                    <select
                      value={batchColId}
                      onChange={(e) => setBatchColId(e.target.value)}
                      className="rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-[var(--fg)]"
                    >
                      <option value="0">不指定</option>
                      {colList.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-[var(--fg)]">
                    <input
                      type="checkbox"
                      checked={batchHidden}
                      onChange={(e) => setBatchHidden(e.target.checked)}
                    />
                    <span>上传后先隐藏</span>
                  </label>
                  {uploadSubTab === "file" && (
                    <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-md border border-[var(--border)] bg-[var(--bg-subtle)] px-2.5 py-1 text-[var(--fg)] font-medium">
                      <input
                        type="checkbox"
                        checked={batchAsGroup}
                        onChange={(e) => setBatchAsGroup(e.target.checked)}
                      />
                      <Layers className="h-3.5 w-3.5 opacity-80" />
                      <span>合并为组图</span>
                    </label>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowUploadMap((v) => !v)}
                    className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 transition cursor-pointer ${
                      showUploadMap || batchGeo.lat !== null || extPhoto.lat !== ""
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-500 font-medium"
                        : "border-[var(--border)] text-[var(--fg)] hover:bg-[var(--bg-subtle)]"
                    }`}
                  >
                    <MapIcon className="h-3.5 w-3.5" />
                    <span>
                      {batchGeo.lat !== null
                        ? `已选点 ${batchGeo.lat.toFixed(2)}, ${batchGeo.lng?.toFixed(2)}`
                        : "地图选点预设坐标"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Interactive Upload Map Coordinate Picker */}
              {showUploadMap && (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)]/70 p-3 space-y-2.5 animate-tab-in">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-[var(--fg)]">
                      点击地图点选拍摄位置（无内置 GPS 的相机原图会自动写入此处所选经纬度与地名）
                    </span>
                    {uploadSubTab === "file" && (
                      <label className="inline-flex items-center gap-1.5 text-[var(--fg-muted)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={batchGeo.overrideExif}
                          onChange={(e) => setBatchGeo({ ...batchGeo, overrideExif: e.target.checked })}
                        />
                        <span>覆盖照片自带 EXIF 坐标</span>
                      </label>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      placeholder="预设拍摄地中文名 (如 东京 · 新宿)"
                      value={uploadSubTab === "file" ? batchGeo.location : extPhoto.location}
                      onChange={(e) =>
                        uploadSubTab === "file"
                          ? setBatchGeo({ ...batchGeo, location: e.target.value })
                          : setExtPhoto({ ...extPhoto, location: e.target.value })
                      }
                      className={INPUT_CLS}
                    />
                    <input
                      placeholder="Location in English (e.g. Shinjuku, Tokyo)"
                      value={uploadSubTab === "file" ? batchGeo.locationEn : extPhoto.locationEn}
                      onChange={(e) =>
                        uploadSubTab === "file"
                          ? setBatchGeo({ ...batchGeo, locationEn: e.target.value })
                          : setExtPhoto({ ...extPhoto, locationEn: e.target.value })
                      }
                      className={INPUT_CLS}
                    />
                  </div>
                  <AdminMapPicker
                    lat={uploadSubTab === "file" ? batchGeo.lat : extPhoto.lat}
                    lng={uploadSubTab === "file" ? batchGeo.lng : extPhoto.lng}
                    onChange={(next) => {
                      if (uploadSubTab === "file") {
                        setBatchGeo((prev) => ({
                          ...prev,
                          lat: next.lat,
                          lng: next.lng,
                          location: next.location || prev.location,
                          locationEn: next.locationEn || prev.locationEn,
                        }));
                      } else {
                        setExtPhoto((prev) => ({
                          ...prev,
                          lat: next.lat ?? "",
                          lng: next.lng ?? "",
                          location: next.location || prev.location,
                          locationEn: next.locationEn || prev.locationEn,
                        }));
                      }
                    }}
                  />
                </div>
              )}

              {uploadSubTab === "file" && batchAsGroup && (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)]/75 p-3 space-y-2.5 animate-tab-in">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 font-medium text-[var(--fg)]">
                      <Layers className="h-3.5 w-3.5 opacity-85" />
                      一次拖入 2 张以上同地点照片，自动按 1、2、3 编号成组并共享以下信息
                    </span>
                    <label className="inline-flex items-center gap-1.5 text-[var(--fg-muted)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={batchGroupMeta.expanded}
                        onChange={(e) =>
                          setBatchGroupMeta({ ...batchGroupMeta, expanded: e.target.checked })
                        }
                      />
                      <span>相册默认平铺展开（不叠卡）</span>
                    </label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      placeholder="组图中文主标题 (如 八坂暮色，留空默认取首张文件名)"
                      value={batchGroupMeta.title}
                      onChange={(e) =>
                        setBatchGroupMeta({ ...batchGroupMeta, title: e.target.value })
                      }
                      className={INPUT_CLS}
                    />
                    <input
                      placeholder="英文主标题 Title (EN，选填)"
                      value={batchGroupMeta.titleEn}
                      onChange={(e) =>
                        setBatchGroupMeta({ ...batchGroupMeta, titleEn: e.target.value })
                      }
                      className={INPUT_CLS}
                    />
                    <input
                      placeholder="组图共用说明 (选填)"
                      value={batchGroupMeta.description}
                      onChange={(e) =>
                        setBatchGroupMeta({ ...batchGroupMeta, description: e.target.value })
                      }
                      className={INPUT_CLS}
                    />
                  </div>
                </div>
              )}

              {uploadSubTab === "file" ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-subtle)] py-6 sm:py-7 px-3 text-center hover:border-[var(--fg-muted)] transition"
                >
                  <Upload className="h-5 w-5 text-[var(--fg-muted)]" />
                  <div className="text-sm font-medium text-[var(--fg)]">
                    {uploading ? uploadProgress : "点击选择多张原图，或直接将照片拖入页面任意位置"}
                  </div>
                  <p className="text-[var(--fg-subtle)]">
                    自动读取机身、镜头、焦段、光圈、快门、ISO、拍摄日期与 GPS 坐标；也可上方点开「地图选点」预设位置
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
              ) : (
                <form onSubmit={handleAddExternal} className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                  <input
                    required
                    placeholder="作品标题"
                    value={extPhoto.title}
                    onChange={(e) => setExtPhoto({ ...extPhoto, title: e.target.value })}
                    className={INPUT_CLS}
                  />
                  <input
                    required
                    placeholder="https://... 图片 URL"
                    value={extPhoto.url}
                    onChange={(e) => setExtPhoto({ ...extPhoto, url: e.target.value })}
                    className={`sm:col-span-2 ${INPUT_CLS}`}
                  />
                  <div className="flex gap-1.5">
                    <input
                      placeholder="地点 (如 京都)"
                      value={extPhoto.location}
                      onChange={(e) => setExtPhoto({ ...extPhoto, location: e.target.value })}
                      className={INPUT_CLS}
                    />
                    <button
                      type="button"
                      onClick={() => setShowUploadMap((v) => !v)}
                      title="在地图上选点"
                      className="shrink-0 rounded-md border border-[var(--border)] px-2.5 text-[var(--fg-muted)] hover:text-[var(--fg)] cursor-pointer"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <button
                    type="submit"
                    className="rounded-md bg-[var(--fg)] px-4 py-1.5 font-medium text-[var(--bg)] hover:opacity-90 cursor-pointer"
                  >
                    添加外链作品
                  </button>
                </form>
              )}
            </section>
          )}

          {/* Split Workspace: Left Grid/List + Right Live Inspector */}
          <div className="flex flex-col lg:flex-row gap-5 items-start">
            {/* Left Library Canvas */}
            <div className="flex-1 min-w-0 w-full">
              {filteredPhotos.length === 0 ? (
                <div className="surface-card rounded-xl py-20 text-center text-xs text-[var(--fg-muted)]">
                  暂无符合筛选条件的作品
                </div>
              ) : viewMode === "grid" ? (
                <div
                  className={`grid gap-3.5 ${
                    editingPhoto
                      ? "grid-cols-2 sm:grid-cols-3"
                      : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5"
                  }`}
                >
                  {visibleLibraryPhotos.map((photo) => {
                    const realIdx = photoList.findIndex((p) => p.id === photo.id);
                    const gInfo = adminGroupMap.get(photo.id);
                    const isGroupCollapsed = Boolean(gInfo && !expandedGroupSet.has(gInfo.groupId));
                    const groupSibIds = gInfo ? gInfo.siblings.map((s) => s.id) : [photo.id];
                    const checked = isGroupCollapsed
                      ? groupSibIds.every((id) => selectedIds.includes(id))
                      : selectedIds.includes(photo.id);
                    const inspecting = isGroupCollapsed
                      ? groupSibIds.includes(editingPhoto?.id ?? -1)
                      : editingPhoto?.id === photo.id;
                    const displayTitle = isGroupCollapsed
                      ? photo.title
                      : formatNumberedTitle(photo.title, gInfo);
                    const canReorder = quickFilter === "all" && !searchQuery;
                    const blockFirstIdx = gInfo
                      ? photoList.findIndex((p) => p.id === gInfo.siblings[0].id)
                      : realIdx;
                    const blockLastIdx = gInfo
                      ? photoList.findIndex((p) => p.id === gInfo.siblings[gInfo.siblings.length - 1].id)
                      : realIdx;
                    const canMovePrev =
                      gInfo && !isGroupCollapsed ? gInfo.index > 1 : blockFirstIdx > 0;
                    const canMoveNext =
                      gInfo && !isGroupCollapsed
                        ? gInfo.index < gInfo.total
                        : blockLastIdx >= 0 && blockLastIdx < photoList.length - 1;

                    return (
                      <div
                        key={photo.id}
                        draggable={canReorder}
                        onDragStart={() => {
                          dragPhotoIdxRef.current = realIdx;
                        }}
                        onDragEnd={() => {
                          dragPhotoIdxRef.current = null;
                          setDragOverPhotoId(null);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (dragOverPhotoId !== photo.id) setDragOverPhotoId(photo.id);
                        }}
                        onDragLeave={() => {
                          if (dragOverPhotoId === photo.id) setDragOverPhotoId(null);
                        }}
                        onDrop={() => {
                          const from = dragPhotoIdxRef.current;
                          dragPhotoIdxRef.current = null;
                          setDragOverPhotoId(null);
                          if (from === null || from === realIdx || realIdx < 0) return;
                          handleLibraryPhotoDrop(from, realIdx);
                        }}
                        onClick={() => selectInspectorPhoto(photo)}
                        className={`surface-card group relative overflow-hidden rounded-lg cursor-pointer transition ${
                          dragOverPhotoId === photo.id
                            ? "ring-2 ring-emerald-400 scale-[0.99]"
                            : inspecting
                            ? "ring-2 ring-[var(--fg)]"
                            : checked
                            ? "ring-1 ring-[var(--fg-muted)]"
                            : "hover:border-[var(--fg-muted)]"
                        } ${isGroupCollapsed ? "shadow-[0_4px_0_-2px_var(--border),0_8px_0_-4px_var(--border)]" : ""}`}
                      >
                        <div className="relative aspect-[3/2] bg-[var(--bg-subtle)] overflow-hidden">
                          <img
                            src={optImg(photo.url, 384, 75)}
                            loading="lazy"
                            decoding="async"
                            draggable={false}
                            alt={photo.title}
                            onLoad={(e) => healPhotoDimensionsIfSwapped(photo, e.currentTarget)}
                            className={`h-full w-full ${
                              (photo.height || 1068) > (photo.width || 1600) ? "object-contain" : "object-cover"
                            } select-none transition-transform duration-300 group-hover:scale-[1.03] ${
                              photo.hidden ? "opacity-45 grayscale-[35%]" : ""
                            }`}
                          />
                          {photo.hidden && (
                            <span className="pointer-events-none absolute bottom-2 left-2 rounded bg-zinc-950/80 px-1.5 py-0.5 text-[10px] font-medium text-zinc-200 backdrop-blur-sm">
                              已隐藏
                            </span>
                          )}
                          {gInfo && (
                            <button
                              type="button"
                              onClick={(e) => toggleSingleGroupExpand(gInfo.groupId, e)}
                              title={isGroupCollapsed ? "点击展开该组全部照片" : "点击收起该组（整组整体移动）"}
                              className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded bg-black/72 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm hover:bg-black/90 transition cursor-pointer"
                            >
                              <Layers className="h-2.5 w-2.5" />
                              <span>
                                {isGroupCollapsed
                                  ? `组图 ${gInfo.total} 幅 · 展开`
                                  : `${gInfo.index}/${gInfo.total} · 收起`}
                              </span>
                            </button>
                          )}
                          {/* Top-Left Checkbox (Always reachable on touch screens) */}
                          <label
                            onClick={(e) => e.stopPropagation()}
                            className={`absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded bg-black/55 backdrop-blur-sm transition cursor-pointer ${
                              checked ? "opacity-100" : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setSelectedIds((prev) =>
                                  checked
                                    ? prev.filter((id) => !groupSibIds.includes(id))
                                    : Array.from(new Set([...prev, ...groupSibIds]))
                                )
                              }
                              className="cursor-pointer"
                            />
                          </label>

                          {/* Top-Right Hide Control */}
                          <div className="absolute right-2 top-2 flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => toggleHidden(photo, e)}
                              title={photo.hidden ? "点击恢复前台公开" : "点击隐藏（前台不展示）"}
                              className={`flex h-6 w-6 items-center justify-center rounded-full backdrop-blur-sm transition cursor-pointer ${
                                photo.hidden
                                  ? "bg-rose-500 text-white"
                                  : "bg-black/45 text-white/80 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:text-white"
                              }`}
                            >
                              {photo.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>

                        <div className="p-2.5 space-y-1 text-xs">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="truncate font-medium text-[var(--fg)]">{displayTitle}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              {canReorder && (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition"
                                >
                                  <button
                                    type="button"
                                    disabled={!canMovePrev}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (gInfo && !isGroupCollapsed) {
                                        reorderGroupFrame(gInfo.siblings, photo.id, -1);
                                      } else {
                                        movePhotoBy(photo.id, -1, e);
                                      }
                                    }}
                                    title={gInfo && !isGroupCollapsed ? "组内前移一帧" : isGroupCollapsed ? "整组前移" : "前移一位"}
                                    className="rounded border border-[var(--border)] p-0.5 text-[var(--fg-muted)] hover:text-[var(--fg)] disabled:opacity-25 cursor-pointer"
                                  >
                                    <ChevronLeft className="h-3 w-3" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!canMoveNext}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (gInfo && !isGroupCollapsed) {
                                        reorderGroupFrame(gInfo.siblings, photo.id, 1);
                                      } else {
                                        movePhotoBy(photo.id, 1, e);
                                      }
                                    }}
                                    title={gInfo && !isGroupCollapsed ? "组内后移一帧" : isGroupCollapsed ? "整组后移" : "后移一位"}
                                    className="rounded border border-[var(--border)] p-0.5 text-[var(--fg-muted)] hover:text-[var(--fg)] disabled:opacity-25 cursor-pointer"
                                  >
                                    <ChevronRight className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                              {photo.lat !== null && (
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" title="含 GPS 坐标" />
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-[var(--fg-muted)]">
                            <span className="truncate">{photo.location ? photo.location.split(",")[0] : CAT_NAME[photo.category] || photo.category}</span>
                            <span className="shrink-0">{photo.focalMm ? `${photo.focalMm}mm` : ""}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Compact Draggable List View */
                <div className="surface-card divide-y divide-[var(--border)] rounded-xl overflow-hidden">
                  {visibleLibraryPhotos.map((photo) => {
                    const realIdx = photoList.findIndex((p) => p.id === photo.id);
                    const gInfo = adminGroupMap.get(photo.id);
                    const isGroupCollapsed = Boolean(gInfo && !expandedGroupSet.has(gInfo.groupId));
                    const groupSibIds = gInfo ? gInfo.siblings.map((s) => s.id) : [photo.id];
                    const checked = isGroupCollapsed
                      ? groupSibIds.every((id) => selectedIds.includes(id))
                      : selectedIds.includes(photo.id);
                    const inspecting = isGroupCollapsed
                      ? groupSibIds.includes(editingPhoto?.id ?? -1)
                      : editingPhoto?.id === photo.id;
                    const displayTitle = isGroupCollapsed
                      ? photo.title
                      : formatNumberedTitle(photo.title, gInfo);
                    const canReorder = quickFilter === "all" && !searchQuery;
                    const blockFirstIdx = gInfo
                      ? photoList.findIndex((p) => p.id === gInfo.siblings[0].id)
                      : realIdx;
                    const blockLastIdx = gInfo
                      ? photoList.findIndex((p) => p.id === gInfo.siblings[gInfo.siblings.length - 1].id)
                      : realIdx;
                    const canMovePrev =
                      gInfo && !isGroupCollapsed ? gInfo.index > 1 : blockFirstIdx > 0;
                    const canMoveNext =
                      gInfo && !isGroupCollapsed
                        ? gInfo.index < gInfo.total
                        : blockLastIdx >= 0 && blockLastIdx < photoList.length - 1;

                    return (
                      <div
                        key={photo.id}
                        draggable={canReorder}
                        onDragStart={() => {
                          dragPhotoIdxRef.current = realIdx;
                        }}
                        onDragEnd={() => {
                          dragPhotoIdxRef.current = null;
                          setDragOverPhotoId(null);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (dragOverPhotoId !== photo.id) setDragOverPhotoId(photo.id);
                        }}
                        onDragLeave={() => {
                          if (dragOverPhotoId === photo.id) setDragOverPhotoId(null);
                        }}
                        onDrop={() => {
                          const from = dragPhotoIdxRef.current;
                          dragPhotoIdxRef.current = null;
                          setDragOverPhotoId(null);
                          if (from === null || from === realIdx || realIdx < 0) return;
                          handleLibraryPhotoDrop(from, realIdx);
                        }}
                        onClick={() => selectInspectorPhoto(photo)}
                        className={`flex items-center justify-between gap-3 px-4 py-2.5 text-xs cursor-pointer transition ${
                          dragOverPhotoId === photo.id
                            ? "bg-emerald-500/10 ring-1 ring-inset ring-emerald-400"
                            : inspecting
                            ? "bg-[var(--bg-subtle)]"
                            : "hover:bg-[var(--bg-subtle)]/60"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                          <GripVertical className="hidden sm:block h-4 w-4 shrink-0 text-[var(--fg-subtle)] cursor-grab" />
                          <input
                            type="checkbox"
                            checked={checked}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() =>
                              setSelectedIds((prev) =>
                                checked
                                  ? prev.filter((id) => !groupSibIds.includes(id))
                                  : Array.from(new Set([...prev, ...groupSibIds]))
                              )
                            }
                          />
                          <img
                            src={optImg(photo.url, 128, 75)}
                            loading="lazy"
                            decoding="async"
                            draggable={false}
                            alt=""
                            onLoad={(e) => healPhotoDimensionsIfSwapped(photo, e.currentTarget)}
                            className={`h-11 w-16 shrink-0 rounded-xs ${
                              (photo.height || 1068) > (photo.width || 1600) ? "object-contain bg-[var(--bg-subtle)]" : "object-cover"
                            } select-none ${
                              photo.hidden ? "opacity-45 grayscale" : ""
                            }`}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate font-medium text-sm text-[var(--fg)]">{displayTitle}</span>
                              {gInfo && (
                                <button
                                  type="button"
                                  onClick={(e) => toggleSingleGroupExpand(gInfo.groupId, e)}
                                  title={isGroupCollapsed ? "展开该组全部照片" : "收起该组（整组整体移动）"}
                                  className="shrink-0 inline-flex items-center gap-1 rounded bg-[var(--bg-subtle)] border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--fg)] hover:border-[var(--fg)] cursor-pointer"
                                >
                                  <Layers className="h-2.5 w-2.5" />
                                  <span>
                                    {isGroupCollapsed
                                      ? `组图 ${gInfo.total} 幅 · 展开`
                                      : `${gInfo.index}/${gInfo.total} · 收起`}
                                  </span>
                                </button>
                              )}
                              {photo.hidden && (
                                <span className="shrink-0 rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] text-rose-400">
                                  已隐藏
                                </span>
                              )}
                            </div>
                            <div className="truncate text-[var(--fg-muted)]">
                              {[CAT_NAME[photo.category] || photo.category, photo.camera, photo.location]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {canReorder && (
                            <div className="flex items-center gap-1">
                              {(!gInfo || isGroupCollapsed) && (
                                <button
                                  type="button"
                                  disabled={blockFirstIdx <= 0}
                                  onClick={(e) => moveBlockToTop(photo.id, e)}
                                  title={isGroupCollapsed ? "整组置顶" : "置顶"}
                                  className="hidden sm:inline-flex rounded border border-[var(--border)] px-1.5 py-1 text-[10px] text-[var(--fg-muted)] hover:text-[var(--fg)] disabled:opacity-25 cursor-pointer"
                                >
                                  置顶
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={!canMovePrev}
                                onClick={(e) => {
                                  if (gInfo && !isGroupCollapsed) {
                                    e.stopPropagation();
                                    reorderGroupFrame(gInfo.siblings, photo.id, -1);
                                  } else {
                                    movePhotoBy(photo.id, -1, e);
                                  }
                                }}
                                title={gInfo && !isGroupCollapsed ? "组内上移一帧" : isGroupCollapsed ? "整组上移" : "上移"}
                                className="rounded border border-[var(--border)] p-1 text-[var(--fg-muted)] hover:text-[var(--fg)] disabled:opacity-25 cursor-pointer"
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={!canMoveNext}
                                onClick={(e) => {
                                  if (gInfo && !isGroupCollapsed) {
                                    e.stopPropagation();
                                    reorderGroupFrame(gInfo.siblings, photo.id, 1);
                                  } else {
                                    movePhotoBy(photo.id, 1, e);
                                  }
                                }}
                                title={gInfo && !isGroupCollapsed ? "组内下移一帧" : isGroupCollapsed ? "整组下移" : "下移"}
                                className="rounded border border-[var(--border)] p-1 text-[var(--fg-muted)] hover:text-[var(--fg)] disabled:opacity-25 cursor-pointer"
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                          {photo.lat !== null && (
                            <span className="hidden sm:inline text-[11px] text-emerald-500">GPS</span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => toggleHidden(photo, e)}
                            title={photo.hidden ? "恢复公开" : "隐藏作品"}
                            className={`rounded p-1.5 border cursor-pointer ${
                              photo.hidden
                                ? "border-rose-500/40 bg-rose-500/15 text-rose-400"
                                : "border-[var(--border)] text-[var(--fg-muted)]"
                            }`}
                          >
                            {photo.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Sticky Live Inspector (Desktop) / Fixed Slide-Up Bottom Sheet (Mobile < lg) */}
            {editingPhoto && (
              <>
                <div
                  onClick={() => setEditingPhoto(null)}
                  className="fixed inset-0 z-40 bg-black/55 backdrop-blur-xs lg:hidden"
                />
                <aside className="surface-card max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-50 max-lg:flex max-lg:max-h-[88dvh] max-lg:flex-col max-lg:rounded-t-2xl max-lg:rounded-b-none max-lg:pb-[max(1rem,env(safe-area-inset-bottom))] max-lg:shadow-2xl w-full lg:w-[400px] lg:sticky lg:top-18 shrink-0 rounded-xl p-4 sm:p-5 space-y-3.5 text-xs animate-tab-in">
                  {/* Mobile Bottom-Sheet Grab Pill */}
                  <div className="mx-auto h-1 w-10 rounded-full bg-[var(--border)] lg:hidden shrink-0" />

                  <div className="flex items-center justify-between border-b border-[var(--border)] pb-2.5 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-[var(--fg)]">作品属性 · #{editingPhoto.id}</span>
                      <div className="flex items-center rounded border border-[var(--border)]">
                        <button
                          type="button"
                          onClick={() => stepInspector(-1)}
                          title="上一幅"
                          className="p-1 text-[var(--fg-muted)] hover:text-[var(--fg)] cursor-pointer"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => stepInspector(1)}
                          title="下一幅"
                          className="p-1 border-l border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)] cursor-pointer"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => movePhotoBy(editingPhoto.id, -1)}
                          title="向前移动排序"
                          className="rounded border border-[var(--border)] p-1 text-[var(--fg-muted)] hover:text-[var(--fg)] cursor-pointer"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => movePhotoBy(editingPhoto.id, 1)}
                          title="向后移动排序"
                          className="rounded border border-[var(--border)] p-1 text-[var(--fg-muted)] hover:text-[var(--fg)] cursor-pointer"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                      </div>
                      <Link
                        href={`/photo/${editingPhoto.id}`}
                        target="_blank"
                        title="打开作品独立页"
                        className="text-[var(--fg-muted)] hover:text-[var(--fg)]"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => setEditingPhoto(null)}
                        className="text-[var(--fg-muted)] hover:text-[var(--fg)] cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Preview + Quick Hidden / Delete */}
                  <div className="flex items-center gap-3 shrink-0">
                    <img
                      src={optImg(editingPhoto.url, 256, 75)}
                      decoding="async"
                      alt=""
                      className={`h-16 w-24 shrink-0 rounded-md bg-[var(--bg-subtle)] object-contain ring-1 ring-[var(--border)] ${
                        editingPhoto.hidden ? "opacity-50 grayscale" : ""
                      }`}
                    />
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="text-[11px] text-[var(--fg-muted)]">
                        画幅：{editingPhoto.width} × {editingPhoto.height}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingPhoto({ ...editingPhoto, hidden: !editingPhoto.hidden })}
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 cursor-pointer ${
                            editingPhoto.hidden
                              ? "border-rose-500/50 bg-rose-500/15 text-rose-400 font-medium"
                              : "border-[var(--border)] text-[var(--fg-muted)]"
                          }`}
                        >
                          {editingPhoto.hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          <span>{editingPhoto.hidden ? "已隐藏" : "隐藏"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => deletePhoto(editingPhoto)}
                          className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[var(--fg-muted)] hover:border-red-500/40 hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" /> 删除
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Fields */}
                  <div className="space-y-3 flex-1 min-h-0 lg:max-h-[56dvh] overflow-y-auto overscroll-contain pr-0.5">
                  {(() => {
                    const inspGroup = adminGroupMap.get(editingPhoto.id);
                    if (!inspGroup) return null;
                    const groupFirstIdx = photoList.findIndex(
                      (p) => p.id === inspGroup.siblings[0].id
                    );
                    const groupLastIdx = photoList.findIndex(
                      (p) => p.id === inspGroup.siblings[inspGroup.siblings.length - 1].id
                    );
                    return (
                      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-2.5 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--fg)]">
                            <Layers className="h-3.5 w-3.5 opacity-85" />
                            组图 · 第 {inspGroup.index} / {inspGroup.total} 幅
                          </span>
                          <div className="flex items-center gap-1">
                            {inspGroup.index > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const next = [...inspGroup.siblings];
                                  const idx = next.findIndex((s) => s.id === editingPhoto.id);
                                  if (idx <= 0) return;
                                  const [picked] = next.splice(idx, 1);
                                  next.unshift(picked);
                                  applyGroupOrderOptimistic(next, editingPhoto.id);
                                }}
                                title="将当前帧设为组图第 1 幅封面"
                                className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[11px] text-[var(--fg-muted)] hover:text-[var(--fg)] cursor-pointer"
                              >
                                设为首图
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={inspGroup.index <= 1}
                              onClick={() =>
                                reorderGroupFrame(inspGroup.siblings, editingPhoto.id, -1)
                              }
                              title="在组内向前移一位（第 1 幅为封面）"
                              className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[11px] text-[var(--fg-muted)] hover:text-[var(--fg)] disabled:opacity-30 cursor-pointer"
                            >
                              ← 前移
                            </button>
                            <button
                              type="button"
                              disabled={inspGroup.index >= inspGroup.total}
                              onClick={() =>
                                reorderGroupFrame(inspGroup.siblings, editingPhoto.id, 1)
                              }
                              title="在组内向后移一位"
                              className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[11px] text-[var(--fg-muted)] hover:text-[var(--fg)] disabled:opacity-30 cursor-pointer"
                            >
                              后移 →
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                          {inspGroup.siblings.map((sib, sIdx) => {
                            const active = sib.id === editingPhoto.id;
                            const sibPortrait = (sib.height || 1068) > (sib.width || 1600);
                            return (
                              <button
                                key={sib.id}
                                type="button"
                                draggable
                                onDragStart={() => {
                                  dragInspFrameIdxRef.current = sIdx;
                                }}
                                onDragEnd={() => {
                                  dragInspFrameIdxRef.current = null;
                                }}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={() => {
                                  const from = dragInspFrameIdxRef.current;
                                  dragInspFrameIdxRef.current = null;
                                  if (from === null || from === sIdx) return;
                                  const next = [...inspGroup.siblings];
                                  const [moved] = next.splice(from, 1);
                                  next.splice(sIdx, 0, moved);
                                  applyGroupOrderOptimistic(next, editingPhoto.id);
                                }}
                                onClick={() => selectInspectorPhoto(sib)}
                                title="点击切换本帧 · 直接拖拽缩略图可调整组内顺序"
                                className={`relative h-12 ${sibPortrait ? "w-8" : "w-16"} shrink-0 overflow-hidden rounded-xs transition cursor-grab active:cursor-grabbing ${
                                  active
                                    ? "ring-2 ring-[var(--fg)] opacity-100"
                                    : "opacity-55 hover:opacity-95 ring-1 ring-[var(--border)]"
                                }`}
                              >
                                <img
                                  src={optImg(sib.url, 128, 75)}
                                  loading="lazy"
                                  decoding="async"
                                  draggable={false}
                                  alt=""
                                  onLoad={(e) => healPhotoDimensionsIfSwapped(sib, e.currentTarget)}
                                  className="h-full w-full object-cover select-none"
                                />
                                <span className="absolute left-1 bottom-0.5 rounded bg-black/70 px-1 text-[10px] font-semibold leading-tight text-white">
                                  {sIdx + 1}
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        {quickFilter === "all" && !searchQuery && (
                          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[var(--border)] text-[11px]">
                            <span className="text-[var(--fg-muted)]">整组位置</span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={groupFirstIdx <= 0}
                                onClick={() => moveBlockToTop(editingPhoto.id)}
                                className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[var(--fg-muted)] hover:text-[var(--fg)] disabled:opacity-30 cursor-pointer"
                              >
                                ⇈ 整组置顶
                              </button>
                              <button
                                type="button"
                                disabled={groupFirstIdx <= 0}
                                onClick={() => movePhotoBy(editingPhoto.id, -1)}
                                className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[var(--fg-muted)] hover:text-[var(--fg)] disabled:opacity-30 cursor-pointer"
                              >
                                ← 整组前移
                              </button>
                              <button
                                type="button"
                                disabled={groupLastIdx >= photoList.length - 1}
                                onClick={() => movePhotoBy(editingPhoto.id, 1)}
                                className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[var(--fg-muted)] hover:text-[var(--fg)] disabled:opacity-30 cursor-pointer"
                              >
                                整组后移 →
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 border-t border-[var(--border)]">
                          <label className="inline-flex items-center gap-1.5 text-[11px] text-[var(--fg)] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(editingPhoto.groupExpanded)}
                              onChange={(e) =>
                                setEditingPhoto({
                                  ...editingPhoto,
                                  groupExpanded: e.target.checked,
                                })
                              }
                            />
                            <span>相册默认平铺展开</span>
                          </label>
                          <div className="flex items-center gap-2 text-[11px]">
                            <button
                              type="button"
                              onClick={() => detachFrameFromGroup(editingPhoto.id)}
                              className="inline-flex items-center gap-1 text-[var(--fg-muted)] hover:text-[var(--fg)] cursor-pointer"
                            >
                              <Unlink className="h-3 w-3" /> 移出本张
                            </button>
                            <button
                              type="button"
                              onClick={() => dissolveGroup(inspGroup.groupId)}
                              className="text-rose-400 hover:underline cursor-pointer"
                            >
                              解散整组
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1">
                      <span className="text-[var(--fg-muted)]">
                        {adminGroupMap.has(editingPhoto.id) ? "组图共用主标题" : "中文标题"}
                      </span>
                      <input
                        value={editingPhoto.title}
                        onChange={(e) => setEditingPhoto({ ...editingPhoto, title: e.target.value })}
                        className={INPUT_CLS}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[var(--fg-muted)]">英文标题</span>
                      <input
                        value={editingPhoto.titleEn}
                        onChange={(e) => setEditingPhoto({ ...editingPhoto, titleEn: e.target.value })}
                        className={INPUT_CLS}
                      />
                    </label>
                  </div>

                  <label className="space-y-1 block">
                    <span className="text-[var(--fg-muted)]">拍摄说明 (中文)</span>
                    <textarea
                      rows={2}
                      value={editingPhoto.description}
                      onChange={(e) => setEditingPhoto({ ...editingPhoto, description: e.target.value })}
                      className={INPUT_CLS}
                    />
                  </label>

                  <label className="space-y-1 block">
                    <span className="text-[var(--fg-muted)]">Description (EN)</span>
                    <textarea
                      rows={2}
                      value={editingPhoto.descriptionEn}
                      onChange={(e) => setEditingPhoto({ ...editingPhoto, descriptionEn: e.target.value })}
                      className={INPUT_CLS}
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1">
                      <span className="text-[var(--fg-muted)]">作品分类</span>
                      <select
                        value={editingPhoto.category}
                        onChange={(e) => setEditingPhoto({ ...editingPhoto, category: e.target.value })}
                        className={INPUT_CLS}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-[var(--fg-muted)]">拍摄日期</span>
                      <input
                        placeholder="2026-01-15"
                        value={editingPhoto.takenAt}
                        onChange={(e) => setEditingPhoto({ ...editingPhoto, takenAt: e.target.value })}
                        className={INPUT_CLS}
                      />
                    </label>
                  </div>

                  {/* Location + Interactive Map Picker + 1-Click Geocode */}
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-2.5 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <span className="text-[var(--fg-muted)] font-medium">地理位置与地图落点</span>
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => setShowInspectorMap((v) => !v)}
                          className="inline-flex items-center gap-1 text-emerald-500 font-medium hover:underline cursor-pointer"
                        >
                          <MapIcon className="h-3 w-3" />
                          <span>{showInspectorMap ? "收起地图" : "地图选点"}</span>
                        </button>
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
                          className="inline-flex items-center gap-1 text-[var(--fg-muted)] hover:text-[var(--fg)] hover:underline cursor-pointer"
                        >
                          <MapPin className="h-3 w-3" />
                          <span>{geocoding ? "定位中…" : "城市名解析"}</span>
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        placeholder="地点 (如 京都, 日本)"
                        value={editingPhoto.location}
                        onChange={(e) => setEditingPhoto({ ...editingPhoto, location: e.target.value })}
                        className={INPUT_CLS}
                      />
                      <input
                        placeholder="Location (EN)"
                        value={editingPhoto.locationEn}
                        onChange={(e) => setEditingPhoto({ ...editingPhoto, locationEn: e.target.value })}
                        className={INPUT_CLS}
                      />
                      <input
                        type="number"
                        step="any"
                        placeholder="纬度 Lat"
                        value={editingPhoto.lat ?? ""}
                        onChange={(e) =>
                          setEditingPhoto({
                            ...editingPhoto,
                            lat: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        className={INPUT_CLS}
                      />
                      <input
                        type="number"
                        step="any"
                        placeholder="经度 Lng"
                        value={editingPhoto.lng ?? ""}
                        onChange={(e) =>
                          setEditingPhoto({
                            ...editingPhoto,
                            lng: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        className={INPUT_CLS}
                      />
                    </div>
                    {showInspectorMap && (
                      <div className="pt-1">
                        <AdminMapPicker
                          lat={editingPhoto.lat}
                          lng={editingPhoto.lng}
                          heightClass="h-44"
                          onChange={(next) =>
                            setEditingPhoto((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    lat: next.lat,
                                    lng: next.lng,
                                    location: prev.location || next.location || "",
                                    locationEn: prev.locationEn || next.locationEn || "",
                                  }
                                : prev
                            )
                          }
                        />
                      </div>
                    )}
                  </div>

                  {/* Camera & Lens with Autocomplete */}
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1">
                      <span className="text-[var(--fg-muted)]">相机机身 (可下拉选择)</span>
                      <input
                        list="known-cameras"
                        value={editingPhoto.camera}
                        onChange={(e) => setEditingPhoto({ ...editingPhoto, camera: e.target.value })}
                        className={INPUT_CLS}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[var(--fg-muted)]">镜头型号 (可下拉选择)</span>
                      <input
                        list="known-lenses"
                        value={editingPhoto.lens}
                        onChange={(e) => setEditingPhoto({ ...editingPhoto, lens: e.target.value })}
                        className={INPUT_CLS}
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    <label className="space-y-1">
                      <span className="text-[var(--fg-muted)]">焦段</span>
                      <input
                        type="number"
                        value={editingPhoto.focalMm ?? ""}
                        onChange={(e) =>
                          setEditingPhoto({
                            ...editingPhoto,
                            focalMm: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        className={INPUT_CLS}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[var(--fg-muted)]">光圈</span>
                      <input
                        placeholder="f/2.0"
                        value={editingPhoto.aperture}
                        onChange={(e) => setEditingPhoto({ ...editingPhoto, aperture: e.target.value })}
                        className={INPUT_CLS}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[var(--fg-muted)]">快门</span>
                      <input
                        placeholder="1/250s"
                        value={editingPhoto.shutter}
                        onChange={(e) => setEditingPhoto({ ...editingPhoto, shutter: e.target.value })}
                        className={INPUT_CLS}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[var(--fg-muted)]">ISO</span>
                      <input
                        type="number"
                        value={editingPhoto.iso ?? ""}
                        onChange={(e) =>
                          setEditingPhoto({
                            ...editingPhoto,
                            iso: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        className={INPUT_CLS}
                      />
                    </label>
                  </div>

                  {/* Series Assignment Chips */}
                  {colList.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[var(--fg-muted)]">归属专题影集：</span>
                      <div className="flex flex-wrap gap-1.5">
                        {colList.map((c) => {
                          const active = editingColIds.includes(c.id);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() =>
                                setEditingColIds((prev) =>
                                  active ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                                )
                              }
                              className={`rounded-full border px-2.5 py-1 text-xs transition cursor-pointer ${
                                active
                                  ? "border-[var(--fg)] bg-[var(--fg)] text-[var(--bg)] font-medium"
                                  : "border-[var(--border)] text-[var(--fg-muted)]"
                              }`}
                            >
                              {c.title}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Save & Save+Next Footer */}
                <div className="flex items-center gap-2 border-t border-[var(--border)] pt-3 shrink-0">
                  <button
                    type="button"
                    disabled={savingPhoto}
                    onClick={() => saveInspectorPhoto(false)}
                    className="flex-1 rounded-md bg-[var(--fg)] py-2 font-medium text-[var(--bg)] hover:opacity-90 disabled:opacity-40 cursor-pointer"
                  >
                    保存修改
                  </button>
                  <button
                    type="button"
                    disabled={savingPhoto}
                    onClick={() => saveInspectorPhoto(true)}
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-[var(--fg)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                  >
                    保存并下一幅 →
                  </button>
                </div>
              </aside>
              </>
            )}
          </div>

          {/* Contextual Floating Bottom Batch Action Bar */}
          {selectedIds.length > 0 && (
            <div className="fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 flex justify-center px-3 sm:px-4 pointer-events-none">
              <div className="pointer-events-auto surface-card flex flex-wrap items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs shadow-2xl animate-tab-in">
                <span className="font-semibold text-[var(--fg)]">已选 {selectedIds.length} 幅</span>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedIds(
                      selectedIds.length === filteredPhotos.length ? [] : filteredPhotos.map((p) => p.id)
                    )
                  }
                  className="text-[var(--fg-muted)] hover:text-[var(--fg)] underline cursor-pointer"
                >
                  {selectedIds.length === filteredPhotos.length ? "取消全选" : "全选当前"}
                </button>

                <span className="h-4 w-[1px] bg-[var(--border)]" />

                {(selectedIds.length >= 2 ||
                  selectedIds.some((id) => Boolean(adminGroupMap.get(id)))) && (
                  <button
                    type="button"
                    disabled={
                      selectedIds.length < 2 &&
                      !selectedIds.some((id) => Boolean(adminGroupMap.get(id)))
                    }
                    onClick={openMergeGroupModal}
                    title="合并为组图，可自由选择保留哪张照片的标题、描述与地点信息并调整组内顺序"
                    className="inline-flex items-center gap-1 rounded bg-[var(--fg)] px-2.5 py-1 font-medium text-[var(--bg)] hover:opacity-90 cursor-pointer"
                  >
                    <Layers className="h-3.5 w-3.5" />
                    <span>合并为组图</span>
                  </button>
                )}

                {selectedIds.some((id) => Boolean(adminGroupMap.get(id))) && (
                  <button
                    type="button"
                    onClick={() => runBatchAction("group_ungroup")}
                    className="inline-flex items-center gap-1 rounded border border-[var(--border)] px-2.5 py-1 text-[var(--fg-muted)] hover:text-[var(--fg)] cursor-pointer"
                  >
                    <Unlink className="h-3.5 w-3.5" />
                    <span>解散组图</span>
                  </button>
                )}

                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      runBatchAction("category", e.target.value);
                      e.target.value = "";
                    }
                  }}
                  className="rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-[var(--fg)]"
                >
                  <option value="">改分类…</option>
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>

                {colList.length > 0 && (
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        runBatchAction("collection", Number(e.target.value));
                        e.target.value = "";
                      }
                    }}
                    className="rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-[var(--fg)]"
                  >
                    <option value="">归入影集…</option>
                    {colList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                )}

                <button
                  type="button"
                  onClick={() => runBatchAction("hidden", true)}
                  className="rounded border border-[var(--border)] px-2.5 py-1 text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                >
                  隐藏
                </button>
                <button
                  type="button"
                  onClick={() => runBatchAction("hidden", false)}
                  className="rounded border border-[var(--border)] px-2.5 py-1 text-[var(--fg-muted)] hover:text-[var(--fg)] cursor-pointer"
                >
                  公开
                </button>
                <button
                  type="button"
                  onClick={() => runBatchAction("delete")}
                  className="rounded border border-red-500/40 px-2.5 py-1 text-red-400 hover:bg-red-500/10 cursor-pointer"
                >
                  删除
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="p-1 text-[var(--fg-muted)] hover:text-[var(--fg)] cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </main>
      )}

      {/* ==================== TAB 2: MASTER-DETAIL SERIES & MONOGRAPH WORKBENCH ==================== */}
      {tab === "collections" && (
        <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 pt-6 pb-20 sm:px-7">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 4 Cols: Reorderable Series List */}
            <div className="lg:col-span-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--fg-muted)]">拖拽可调整前台影集展示先后顺序</span>
                <button
                  type="button"
                  onClick={() => openCollectionEditor()}
                  className="inline-flex items-center gap-1 rounded-md bg-[var(--fg)] px-3 py-1.5 text-xs font-medium text-[var(--bg)] cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" /> 新建影集
                </button>
              </div>

              <div className="space-y-2.5">
                {colList.map((col, idx) => {
                  const active = editingCol?.id === col.id;
                  const covCount = parseMonographBlocks(col.blocksJson, col).filter(
                    (b) => b.kind === "cover"
                  ).length;
                  return (
                    <div
                      key={col.id}
                      draggable
                      onDragStart={() => {
                        dragColIdxRef.current = idx;
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        const from = dragColIdxRef.current;
                        dragColIdxRef.current = null;
                        if (from === null || from === idx) return;
                        const next = [...colList];
                        const [moved] = next.splice(from, 1);
                        next.splice(idx, 0, moved);
                        persistCollectionOrder(next);
                      }}
                      onClick={() => openCollectionEditor(col)}
                      className={`surface-card flex items-center justify-between gap-3 rounded-xl p-3 cursor-pointer transition ${
                        active ? "ring-2 ring-[var(--fg)]" : "hover:border-[var(--fg-muted)]"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <GripVertical className="h-4 w-4 shrink-0 text-[var(--fg-subtle)] cursor-grab" />
                        {col.coverUrl && (
                          <img src={optImg(col.coverUrl, 256, 75)} loading="lazy" decoding="async" alt="" className="h-12 w-18 shrink-0 rounded-sm object-cover" />
                        )}
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-[var(--fg)]">{col.title}</div>
                          <div className="text-[11px] text-[var(--fg-muted)]">
                            {col.period} · {col.photoCount} 幅 · {covCount} 扉页
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            const next = [...colList];
                            [next[idx], next[idx - 1]] = [next[idx - 1], next[idx]];
                            persistCollectionOrder(next);
                          }}
                          className="lg:hidden rounded border border-[var(--border)] p-1 text-[var(--fg-muted)] disabled:opacity-25 cursor-pointer"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === colList.length - 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            const next = [...colList];
                            [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                            persistCollectionOrder(next);
                          }}
                          className="lg:hidden rounded border border-[var(--border)] p-1 text-[var(--fg-muted)] disabled:opacity-25 cursor-pointer"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteCollection(col.id, col.title);
                          }}
                          className="p-1.5 text-[var(--fg-subtle)] hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right 8 Cols: Active Monograph Visual Editor */}
            <div ref={colEditorRef} className="lg:col-span-8 scroll-mt-24">
              {editingCol ? (
                <form onSubmit={saveCollection} className="surface-card rounded-xl p-5 sm:p-6 space-y-5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3.5">
                    <div>
                      <h2 className="text-base font-semibold text-[var(--fg)]">
                        {editingCol.id ? `编辑《${editingCol.title || "未命名"}》` : "新建专题影集"}
                      </h2>
                      <p className="text-[var(--fg-muted)] mt-0.5">
                        自由插入多个画册扉页，或为单幅作品填写旁注文字生成图文对开页
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {editingCol.id && editingCol.slug && (
                        <Link
                          href={`/collections/${editingCol.slug}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-3 py-1.5 text-[var(--fg)] hover:bg-[var(--bg-subtle)]"
                        >
                          <span>前台预览</span>
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                      <button
                        type="submit"
                        className="rounded-md bg-[var(--fg)] px-4 py-1.5 font-medium text-[var(--bg)] hover:opacity-90 cursor-pointer"
                      >
                        保存画册编排
                      </button>
                    </div>
                  </div>

                  {/* Series Basic Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <label className="space-y-1">
                      <span className="text-[var(--fg-muted)]">中文名称</span>
                      <input
                        required
                        value={editingCol.title}
                        onChange={(e) => setEditingCol({ ...editingCol, title: e.target.value })}
                        className={INPUT_CLS}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[var(--fg-muted)]">英文名称</span>
                      <input
                        value={editingCol.titleEn}
                        onChange={(e) => {
                          const titleEn = e.target.value;
                          const autoSlug =
                            !editingCol.id && !editingCol.slug
                              ? titleEn
                                  .toLowerCase()
                                  .replace(/[^a-z0-9]+/g, "-")
                                  .replace(/^-|-$/g, "")
                              : editingCol.slug;
                          setEditingCol({ ...editingCol, titleEn, slug: autoSlug });
                        }}
                        className={INPUT_CLS}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[var(--fg-muted)]">URL 路径标识 (slug)</span>
                      <input
                        required
                        placeholder="如 nordic-2026"
                        value={editingCol.slug}
                        onChange={(e) => setEditingCol({ ...editingCol, slug: e.target.value })}
                        className={INPUT_CLS}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[var(--fg-muted)]">时间跨度</span>
                      <input
                        placeholder="2025—2026"
                        value={editingCol.period}
                        onChange={(e) => setEditingCol({ ...editingCol, period: e.target.value })}
                        className={INPUT_CLS}
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="space-y-1">
                      <span className="text-[var(--fg-muted)]">列表导语 (中文)</span>
                      <textarea
                        rows={2}
                        value={editingCol.description}
                        onChange={(e) => setEditingCol({ ...editingCol, description: e.target.value })}
                        className={INPUT_CLS}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[var(--fg-muted)]">Series Summary (EN)</span>
                      <textarea
                        rows={2}
                        value={editingCol.descriptionEn}
                        onChange={(e) => setEditingCol({ ...editingCol, descriptionEn: e.target.value })}
                        className={INPUT_CLS}
                      />
                    </label>
                  </div>

                  {/* 1-Click Cover Picker + Collapsible Photo Selector */}
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-3.5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-[var(--fg)]">
                        已收录作品（点击缩略图左下角「设封面」可一键切换影集封面）
                      </span>
                      <button
                        type="button"
                        onClick={() => setPickerOpen((v) => !v)}
                        className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1 text-[var(--fg)] hover:opacity-85 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>{pickerOpen ? "收起全部选片库" : "从全部作品中增删选片"}</span>
                      </button>
                    </div>

                    {pickerOpen && (
                      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 border-t border-[var(--border)] pt-3 max-h-52 overflow-y-auto">
                        {photoList.map((p) => {
                          const included = editingCol.blocks.some((b) => b.kind === "photo" && b.photoId === p.id);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => togglePhotoInMonograph(p.id)}
                              className={`relative aspect-[3/2] overflow-hidden rounded-xs cursor-pointer ${
                                included ? "ring-2 ring-[var(--fg)] opacity-100" : "opacity-40 hover:opacity-80"
                              }`}
                            >
                              <img src={optImg(p.url, 256, 75)} loading="lazy" decoding="async" alt={p.title} className="h-full w-full object-cover" />
                              {included && (
                                <span className="absolute right-1 top-1 rounded-full bg-[var(--fg)] p-0.5 text-[var(--bg)]">
                                  <Check className="h-2.5 w-2.5" />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Visual Monograph Storyboard */}
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-[var(--fg)]">
                        画册章节与页面流（共 {editingCol.blocks.length} 节 · 可上下拖拽排序）
                      </span>
                      <button
                        type="button"
                        onClick={() => insertCoverBlockAt()}
                        className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 font-medium text-amber-500 hover:bg-amber-500/20 transition cursor-pointer"
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                        <span>+ 插入画册扉页</span>
                      </button>
                    </div>

                    <div className="space-y-2.5">
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
                              className="rounded-lg border border-amber-500/35 bg-amber-500/[0.05] p-3.5 space-y-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <GripVertical className="h-4 w-4 text-[var(--fg-subtle)] cursor-grab" />
                                  <span className="inline-flex items-center gap-1 font-semibold text-amber-500">
                                    <BookOpen className="h-3.5 w-3.5" /> 扉页 #{bIdx + 1}
                                  </span>
                                  <div className="flex items-center rounded-md border border-[var(--border)] bg-[var(--bg)] p-0.5">
                                    {(
                                      [
                                        ["full", "全屏大图"],
                                        ["split", "左右图文"],
                                        ["minimal", "纯文字页"],
                                      ] as [CoverStyle, string][]
                                    ).map(([st, label]) => (
                                      <button
                                        key={st}
                                        type="button"
                                        onClick={() => updateBlockAt(bIdx, { style: st })}
                                        className={`rounded px-2 py-0.5 text-[11px] cursor-pointer ${
                                          block.style === st
                                            ? "bg-[var(--fg)] text-[var(--bg)] font-medium"
                                            : "text-[var(--fg-muted)]"
                                        }`}
                                      >
                                        {label}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => moveBlock(bIdx, -1)}
                                    disabled={bIdx === 0}
                                    className="rounded border border-[var(--border)] p-1 text-[var(--fg-muted)] disabled:opacity-25 cursor-pointer"
                                  >
                                    <ArrowUp className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => moveBlock(bIdx, 1)}
                                    disabled={bIdx === editingCol.blocks.length - 1}
                                    className="rounded border border-[var(--border)] p-1 text-[var(--fg-muted)] disabled:opacity-25 cursor-pointer"
                                  >
                                    <ArrowDown className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingCol({
                                        ...editingCol,
                                        blocks: editingCol.blocks.filter((_, i) => i !== bIdx),
                                      })
                                    }
                                    className="rounded border border-[var(--border)] p-1 text-[var(--fg-muted)] hover:text-red-400 cursor-pointer"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>

                              {block.style !== "minimal" && (
                                <div className="flex items-center gap-2.5">
                                  {block.imageUrl && (
                                    <img
                                      src={optImg(block.imageUrl, 256, 75)}
                                      loading="lazy"
                                      decoding="async"
                                      alt=""
                                      className="h-10 w-15 shrink-0 rounded-xs object-cover"
                                    />
                                  )}
                                  <select
                                    value={block.imageUrl}
                                    onChange={(e) => updateBlockAt(bIdx, { imageUrl: e.target.value })}
                                    className={INPUT_CLS}
                                  >
                                    <option value="">选择扉页背景作品…</option>
                                    {photoList.map((p) => (
                                      <option key={p.id} value={p.url}>
                                        {p.title} ({p.location || p.url})
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}

                              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                                <input
                                  placeholder="章节号 (如 CHAPTER I)"
                                  value={block.eyebrow}
                                  onChange={(e) =>
                                    updateBlockAt(bIdx, { eyebrow: e.target.value, eyebrowEn: e.target.value })
                                  }
                                  className={INPUT_CLS}
                                />
                                <input
                                  placeholder="扉页标题 (中文)"
                                  value={block.title}
                                  onChange={(e) => updateBlockAt(bIdx, { title: e.target.value })}
                                  className={`sm:col-span-2 ${INPUT_CLS}`}
                                />
                                <input
                                  placeholder="Title (EN)"
                                  value={block.titleEn}
                                  onChange={(e) => updateBlockAt(bIdx, { titleEn: e.target.value })}
                                  className={INPUT_CLS}
                                />
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <textarea
                                  rows={2}
                                  placeholder="扉页导语 / 章节引言 (中文)"
                                  value={block.body}
                                  onChange={(e) => updateBlockAt(bIdx, { body: e.target.value })}
                                  className={INPUT_CLS}
                                />
                                <textarea
                                  rows={2}
                                  placeholder="Chapter Preface (EN)"
                                  value={block.bodyEn}
                                  onChange={(e) => updateBlockAt(bIdx, { bodyEn: e.target.value })}
                                  className={INPUT_CLS}
                                />
                              </div>
                            </div>
                          );
                        }

                        const p = photoMap.get(block.photoId);
                        if (!p) return null;
                        const isSeriesCover = editingCol.coverUrl === p.url;

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
                            className="rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)]/60 p-3 space-y-2.5"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-3 min-w-0">
                                <GripVertical className="h-4 w-4 shrink-0 text-[var(--fg-subtle)] cursor-grab" />
                                <div className="relative h-11 w-16 shrink-0 overflow-hidden rounded-xs">
                                  <img src={optImg(p.url, 256, 75)} loading="lazy" decoding="async" alt="" className="h-full w-full object-cover" />
                                  <button
                                    type="button"
                                    onClick={() => setEditingCol({ ...editingCol, coverUrl: p.url })}
                                    className={`absolute inset-x-0 bottom-0 py-0.5 text-[9px] text-center cursor-pointer ${
                                      isSeriesCover
                                        ? "bg-emerald-500 text-white font-semibold"
                                        : "bg-black/65 text-white/85 hover:bg-black"
                                    }`}
                                  >
                                    {isSeriesCover ? "当前封面" : "设为封面"}
                                  </button>
                                </div>
                                <div className="min-w-0">
                                  <div className="truncate font-medium text-[var(--fg)]">
                                    {block.customTitle?.trim() ? (
                                      <>
                                        {block.customTitle.trim()}
                                        <span className="ml-1.5 font-normal text-[11px] text-[var(--fg-muted)]">
                                          （原：{p.title}）
                                        </span>
                                      </>
                                    ) : (
                                      p.title
                                    )}
                                  </div>
                                  <div className="text-[11px] text-[var(--fg-muted)]">{p.location}</div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => insertCoverBlockAt(bIdx)}
                                  title="在此照片上方插入章节扉页"
                                  className="rounded border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--fg-muted)] hover:text-[var(--fg)] cursor-pointer"
                                >
                                  + 上插扉页
                                </button>
                                <select
                                  value={block.noteAlign}
                                  onChange={(e) =>
                                    updateBlockAt(bIdx, { noteAlign: e.target.value as "right" | "left" })
                                  }
                                  className="rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-[11px]"
                                >
                                  <option value="right">图左 · 旁注在右</option>
                                  <option value="left">旁注在左 · 图右</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() => moveBlock(bIdx, -1)}
                                  disabled={bIdx === 0}
                                  className="rounded border border-[var(--border)] p-1 text-[var(--fg-muted)] disabled:opacity-25 cursor-pointer"
                                >
                                  <ArrowUp className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveBlock(bIdx, 1)}
                                  disabled={bIdx === editingCol.blocks.length - 1}
                                  className="rounded border border-[var(--border)] p-1 text-[var(--fg-muted)] disabled:opacity-25 cursor-pointer"
                                >
                                  <ArrowDown className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditingCol({
                                      ...editingCol,
                                      blocks: editingCol.blocks.filter((_, i) => i !== bIdx),
                                    })
                                  }
                                  className="rounded border border-[var(--border)] p-1 text-[var(--fg-muted)] hover:text-red-400 cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <input
                                placeholder={`影集内自定义标题 (留空默认「${p.title}」，不带组图序号)`}
                                value={block.customTitle || ""}
                                onChange={(e) => updateBlockAt(bIdx, { customTitle: e.target.value })}
                                className={INPUT_CLS}
                              />
                              <input
                                placeholder={
                                  p.titleEn
                                    ? `Custom Plate Title (EN, default: ${p.titleEn})`
                                    : "Custom Plate Title (EN, 可选)"
                                }
                                value={block.customTitleEn || ""}
                                onChange={(e) => updateBlockAt(bIdx, { customTitleEn: e.target.value })}
                                className={INPUT_CLS}
                              />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <input
                                placeholder="照片旁注文字 (填写后呈图文并排画册对开页，留空则纯图留白)"
                                value={block.sideNote}
                                onChange={(e) => updateBlockAt(bIdx, { sideNote: e.target.value })}
                                className={INPUT_CLS}
                              />
                              <input
                                placeholder="Side Note (EN, 可选)"
                                value={block.sideNoteEn}
                                onChange={(e) => updateBlockAt(bIdx, { sideNoteEn: e.target.value })}
                                className={INPUT_CLS}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </form>
              ) : (
                <div className="surface-card rounded-xl py-24 text-center text-xs text-[var(--fg-muted)]">
                  在左侧选择一个影集或点击「新建影集」开始编排
                </div>
              )}
            </div>
          </div>
        </main>
      )}

      {/* ==================== TAB 3: GEAR STUDIO + 1-CLICK EXIF SYNC ==================== */}
      {tab === "gear" && (
        <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pt-6 pb-20 sm:px-7 space-y-6 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[var(--fg-muted)]">
              管理常用机身与镜头档案；支持直接从已上传作品的 EXIF 信息一键同步新器材。
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={syncingGear}
                onClick={syncGearFromExif}
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-subtle)] px-3.5 py-1.5 font-medium text-[var(--fg)] hover:opacity-85 cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncingGear ? "animate-spin" : ""}`} />
                <span>从作品 EXIF 一键同步器材</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setEditingGear({ type: "camera", brand: "", name: "", specs: "", note: "", noteEn: "" })
                }
                className="inline-flex items-center gap-1 rounded-md bg-[var(--fg)] px-3.5 py-1.5 font-medium text-[var(--bg)] cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" /> 新增器材
              </button>
            </div>
          </div>

          {editingGear && (
            <form onSubmit={saveGearForm} className="surface-card rounded-xl p-5 space-y-3 animate-tab-in">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2.5">
                <span className="font-semibold text-sm">{editingGear.id ? "编辑器材" : "新增器材"}</span>
                <button type="button" onClick={() => setEditingGear(null)} className="cursor-pointer">
                  <X className="h-4 w-4 text-[var(--fg-muted)]" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <select
                  value={editingGear.type}
                  onChange={(e) => setEditingGear({ ...editingGear, type: e.target.value })}
                  className={INPUT_CLS}
                >
                  <option value="camera">相机机身</option>
                  <option value="lens">光学镜头</option>
                </select>
                <input
                  placeholder="品牌 (如 Leica)"
                  value={editingGear.brand}
                  onChange={(e) => setEditingGear({ ...editingGear, brand: e.target.value })}
                  className={INPUT_CLS}
                />
                <input
                  required
                  placeholder="完整型号 (与 EXIF 一致)"
                  value={editingGear.name}
                  onChange={(e) => setEditingGear({ ...editingGear, name: e.target.value })}
                  className={INPUT_CLS}
                />
                <input
                  placeholder="规格参数 (如 60MP Rangefinder)"
                  value={editingGear.specs}
                  onChange={(e) => setEditingGear({ ...editingGear, specs: e.target.value })}
                  className={INPUT_CLS}
                />
              </div>
              <div className="flex gap-3">
                <input
                  placeholder="使用备注 (可选)"
                  value={editingGear.note}
                  onChange={(e) => setEditingGear({ ...editingGear, note: e.target.value })}
                  className={INPUT_CLS}
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-md bg-[var(--fg)] px-5 py-1.5 font-medium text-[var(--bg)] cursor-pointer"
                >
                  保存器材
                </button>
              </div>
            </form>
          )}

          {(["camera", "lens"] as const).map((gType) => {
            const items = initialGear.filter((g) => g.type === gType);
            return (
              <section key={gType} className="space-y-3">
                <h3 className="text-sm font-semibold text-[var(--fg)]">
                  {gType === "camera" ? `相机机身 (${items.length})` : `光学镜头 (${items.length})`}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {items.map((g, gIdx) => (
                    <div
                      key={g.id}
                      className="surface-card flex items-center justify-between gap-3 rounded-xl p-4"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        {gType === "camera" ? (
                          <CameraIllustration name={g.name} className="h-11 w-auto shrink-0" />
                        ) : (
                          <LensIllustration name={g.name} className="h-10 w-14 shrink-0" />
                        )}
                        <div className="min-w-0 space-y-0.5">
                          <div className="text-[10px] uppercase tracking-wider text-[var(--fg-subtle)]">
                            {g.brand || gType}
                          </div>
                          <div className="truncate text-sm font-semibold text-[var(--fg)]">{g.name}</div>
                          <div className="text-[11px] text-[var(--fg-muted)]">
                            {[g.specs, `${g.photoCount} 幅作品`].filter(Boolean).join(" · ")}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={gIdx === 0}
                          onClick={() => moveGearItem(g.id, -1, items)}
                          className="rounded border border-[var(--border)] p-1 text-[var(--fg-muted)] hover:text-[var(--fg)] disabled:opacity-25 cursor-pointer"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={gIdx === items.length - 1}
                          onClick={() => moveGearItem(g.id, 1, items)}
                          className="rounded border border-[var(--border)] p-1 text-[var(--fg-muted)] hover:text-[var(--fg)] disabled:opacity-25 cursor-pointer"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingGear({ ...g })}
                          className="rounded border border-[var(--border)] p-1.5 text-[var(--fg-muted)] hover:text-[var(--fg)] cursor-pointer"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeGearItem(g.id)}
                          className="rounded border border-[var(--border)] p-1.5 text-[var(--fg-muted)] hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </main>
      )}

      {/* ==================== TAB: HOMEPAGE CURATION WORKBENCH ==================== */}
      {tab === "homepage" && (
        <AdminHomepageTab
          photos={photoList}
          collections={colList}
          settings={settingsForm}
          onSaved={(patch, msg) => {
            setSettingsForm((prev) => ({ ...prev, ...patch }));
            notify(msg);
            router.refresh();
          }}
        />
      )}

      {/* ==================== TAB 4: SITE & ABOUT VISUAL CONFIGURATOR ==================== */}
      {tab === "settings" && (
        <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pt-6 pb-24 sm:px-7 text-xs">
          <form onSubmit={saveSettings} className="space-y-6">
            {/* Top Live Profile Preview + Save Button */}
            <section className="surface-card flex flex-wrap items-center justify-between gap-4 rounded-xl p-5">
              <div className="flex items-center gap-4">
                <img
                  src={optImg(settingsForm.avatarUrl || "/samples/avatar.jpg", 256, 75)}
                  decoding="async"
                  alt=""
                  className="h-14 w-14 rounded-full object-cover ring-1 ring-[var(--border)]"
                />
                <div>
                  <div className="text-base font-semibold text-[var(--fg)]">
                    {settingsForm.photographerName || "林远"}{" "}
                    <span className="text-xs font-normal text-[var(--fg-muted)]">
                      {settingsForm.photographerNameEn}
                    </span>
                  </div>
                  <div className="text-[var(--fg-muted)]">{settingsForm.tagline}</div>
                </div>
              </div>

              <button
                type="submit"
                className={`rounded-md px-5 py-2 font-medium transition cursor-pointer ${
                  settingsDirty
                    ? "bg-emerald-500 text-white shadow-md"
                    : "bg-[var(--fg)] text-[var(--bg)] hover:opacity-90"
                }`}
              >
                {settingsDirty ? "保存未提交的更改" : "保存全部配置"}
              </button>
            </section>

            {/* Feature Toggle Switches */}
            <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(
                [
                  [
                    "copyrightGuard",
                    settingsForm.copyrightGuard === "true",
                    "开启原图下载保护",
                    "禁用前台右键另存与拖拽图片，隐藏灯箱“原图”链接，仅允许下载带署名签名框。",
                  ],
                  [
                    "showShootingStats",
                    settingsForm.showShootingStats !== "false",
                    "关于页展示「拍摄习惯统计」",
                    "自动根据作品库聚合统计常用焦段分布、机身使用率与题材占比。",
                  ],
                ] as const
              ).map(([key, enabled, title, desc]) => (
                <div
                  key={key}
                  onClick={() => {
                    setSettingsForm({ ...settingsForm, [key]: enabled ? "false" : "true" });
                    setSettingsDirty(true);
                  }}
                  className="surface-card flex items-center justify-between gap-4 rounded-xl p-4 cursor-pointer"
                >
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium text-[var(--fg)]">{title}</div>
                    <p className="text-[var(--fg-muted)]">{desc}</p>
                  </div>
                  <div
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                      enabled ? "bg-emerald-500" : "bg-[var(--border)]"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        enabled ? "translate-x-5.5" : "translate-x-0.5"
                      }`}
                    />
                  </div>
                </div>
              ))}
            </section>

            {/* Agent / CLI Open REST API Key & Documentation */}
            <section className="surface-card rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--fg)]">
                    <Terminal className="h-4 w-4 text-emerald-500" />
                    <span>Agent / CLI 开放管理 API</span>
                  </h3>
                  <p className="text-[var(--fg-muted)]">
                    让 AI Agent、脚本或命令行通过{" "}
                    <code className="rounded bg-[var(--bg-subtle)] px-1.5 py-0.5">
                      Authorization: Bearer &lt;API_KEY&gt;
                    </code>{" "}
                    直接上传、编辑、隐藏作品或维护影集与站点设置。
                  </p>
                </div>
                <Link
                  href="/api/admin/openapi"
                  target="_blank"
                  className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-3 py-1.5 text-[var(--fg)] hover:bg-[var(--bg-subtle)]"
                >
                  <span>OpenAPI 3.1 规范</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--fg-subtle)]" />
                  <input
                    value={settingsForm.apiKey || ""}
                    onChange={(e) => {
                      setSettingsForm({ ...settingsForm, apiKey: e.target.value });
                      setSettingsDirty(true);
                    }}
                    placeholder="点击右侧「生成新密钥」或自定义 8 位以上 API Key（亦支持环境变量 ADMIN_API_KEY）"
                    className={`pl-8 font-mono ${INPUT_CLS}`}
                  />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={generateAndSaveApiKey}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-1.5 font-medium text-[var(--fg)] hover:opacity-85 cursor-pointer"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>生成新密钥</span>
                  </button>
                  {settingsForm.apiKey && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(settingsForm.apiKey);
                        notify("API Key 已复制到剪贴板");
                      }}
                      className="inline-flex items-center justify-center gap-1 rounded-md border border-[var(--border)] px-3 py-1.5 text-[var(--fg)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span>复制</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)]/70 p-3 font-mono text-[11px] leading-relaxed text-[var(--fg-muted)] overflow-x-auto space-y-0.5">
                <div># 1. Agent 自发现完整 OpenAPI 3.1 规范（100% 覆盖后台所有管理能力）：GET /api/admin/openapi</div>
                <div>
                  curl {(settingsForm.siteUrl || "http://localhost:3000").replace(/\/$/, "")}/api/admin/openapi
                </div>
                <div># 2. 自定义首页精选轮播、影集与相册展示列表及顺序：PUT /api/admin/homepage</div>
                <div>
                  curl -X PUT -H &quot;Authorization: Bearer {settingsForm.apiKey || "$API_KEY"}&quot; -H &quot;Content-Type: application/json&quot; -d &apos;&#123;&quot;featuredIds&quot;:[3,1,5],&quot;collectionIds&quot;:[2,1],&quot;galleryIds&quot;:[8,4,2]&#125;&apos;{" "}
                  {(settingsForm.siteUrl || "http://localhost:3000").replace(/\/$/, "")}/api/admin/homepage
                </div>
                <div># 3. 上传原图 / 合并组图 / 服务端裁剪网站图标与头像 / 器材与站点配置：</div>
                <div>
                  POST /api/admin/upload · PATCH /api/admin/photos (group_merge/reorder) · PATCH /api/admin/collections/:id (photoTitles/blocks) · POST /api/admin/asset (target=favicon|avatar, apply=true) · /api/admin/gear · /api/admin/settings
                </div>
              </div>
            </section>

            {/* Website Title, Favicon & Avatar Upload + Crop Studio */}
            <section className="surface-card rounded-xl p-5 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--fg)]">
                    <Globe className="h-4 w-4 text-emerald-500" />
                    <span>网站标题、图标 (Favicon) 与头像设置</span>
                  </h3>
                  <p className="text-[var(--fg-muted)]">
                    支持自定义浏览器标签页标题与 SEO 摘要；网站图标和摄影师头像可直接上传本地图片并交互式裁剪，确认即刻生效。
                  </p>
                </div>

                {/* Live Browser Tab Preview Pill */}
                <div className="inline-flex max-w-full items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 shadow-xs">
                  <img
                    src={resolveFaviconUrl(settingsForm)}
                    alt=""
                    className="h-4 w-4 shrink-0 object-contain"
                  />
                  <span className="truncate max-w-[260px] text-xs font-medium text-[var(--fg)]">
                    {resolveSiteTitle(settingsForm)}
                  </span>
                </div>
              </div>

              {/* Site Title & Description */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <label className="space-y-1 block">
                  <span className="text-[var(--fg-muted)]">网站标题（浏览器标签页 Title，留空自动根据署名生成）</span>
                  <input
                    value={settingsForm.siteTitle || ""}
                    onChange={(e) => {
                      setSettingsForm({ ...settingsForm, siteTitle: e.target.value });
                      setSettingsDirty(true);
                    }}
                    placeholder={buildAutoSiteTitle(settingsForm)}
                    className={INPUT_CLS}
                  />
                </label>
                <label className="space-y-1 block">
                  <span className="text-[var(--fg-muted)]">网站描述（搜索引擎与社交分享摘要，留空默认使用一句话简介）</span>
                  <input
                    value={settingsForm.siteDescription || ""}
                    onChange={(e) => {
                      setSettingsForm({ ...settingsForm, siteDescription: e.target.value });
                      setSettingsDirty(true);
                    }}
                    placeholder={settingsForm.tagline || "记录自然尺幅、城市暮色与行旅瞬间"}
                    className={INPUT_CLS}
                  />
                </label>
              </div>

              {/* Direct Upload & Crop Cards: Favicon + Avatar */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                {/* Card A: Site Favicon */}
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)]/50 p-4 space-y-3">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg)] p-2">
                      <img
                        src={resolveFaviconUrl(settingsForm)}
                        alt="网站图标"
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="font-semibold text-[var(--fg)]">网站图标 (Favicon / 主屏幕图标)</div>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          ref={faviconFileRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            openLocalFileCrop("favicon", e.target.files?.[0]);
                            e.currentTarget.value = "";
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => faviconFileRef.current?.click()}
                          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--fg)] px-3 py-1.5 font-medium text-[var(--bg)] hover:opacity-90 cursor-pointer"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          <span>上传并裁剪</span>
                        </button>
                        {settingsForm.faviconUrl && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                setCropModal({ mode: "favicon", src: settingsForm.faviconUrl })
                              }
                              className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[var(--fg)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                            >
                              <Crop className="h-3.5 w-3.5" />
                              <span>重新裁剪</span>
                            </button>
                            <button
                              type="button"
                              onClick={resetDefaultFavicon}
                              className="rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[var(--fg-muted)] hover:text-[var(--fg)] cursor-pointer"
                            >
                              恢复默认
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <input
                    value={settingsForm.faviconUrl || ""}
                    onChange={(e) => {
                      setSettingsForm({ ...settingsForm, faviconUrl: e.target.value });
                      setSettingsDirty(true);
                    }}
                    placeholder="或直接填写图标图片 URL（留空使用内置极简镜头图标）"
                    className={INPUT_CLS}
                  />
                </div>

                {/* Card B: Photographer Avatar */}
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)]/50 p-4 space-y-3">
                  <div className="flex items-center gap-3.5">
                    <img
                      src={optImg(settingsForm.avatarUrl || "/samples/avatar.jpg", 256, 75)}
                      decoding="async"
                      alt="摄影师头像"
                      className="h-14 w-14 shrink-0 rounded-full object-cover ring-1 ring-[var(--border)]"
                    />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="font-semibold text-[var(--fg)]">摄影师头像 (关于页与工作台)</div>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          ref={avatarFileRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            openLocalFileCrop("avatar", e.target.files?.[0]);
                            e.currentTarget.value = "";
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => avatarFileRef.current?.click()}
                          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--fg)] px-3 py-1.5 font-medium text-[var(--bg)] hover:opacity-90 cursor-pointer"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          <span>上传并裁剪</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setCropModal({
                              mode: "avatar",
                              src: settingsForm.avatarUrl || "/samples/avatar.jpg",
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[var(--fg)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                        >
                          <Crop className="h-3.5 w-3.5" />
                          <span>裁剪当前图</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  <input
                    value={settingsForm.avatarUrl || ""}
                    onChange={(e) => {
                      setSettingsForm({ ...settingsForm, avatarUrl: e.target.value });
                      setSettingsDirty(true);
                    }}
                    placeholder="或直接填写头像图片 URL"
                    className={INPUT_CLS}
                  />
                </div>
              </div>
            </section>

            {/* Basic Profile & Social Fields */}
            <section className="surface-card rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-[var(--fg)]">摄影师名片、域名与联系方式</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {[
                  ["photographerName", "摄影师署名 (中文)"],
                  ["photographerNameEn", "Photographer Name (EN)"],
                  ["siteUrl", "站点域名 (RSS / Sitemap / 分享)"],
                  ["baseLocation", "常驻城市 (中文)"],
                  ["baseLocationEn", "Base Location (EN)"],
                  ["tagline", "一句话简介 (中文)"],
                  ["taglineEn", "Tagline (EN)"],
                  ["email", "联系邮箱"],
                  ["instagram", "Instagram 链接 (留空隐藏)"],
                  ["xiaohongshu", "小红书链接 (留空隐藏)"],
                  ["aboutAvailableText", "合作状态徽章 (中文，留空隐藏)"],
                  ["aboutAvailableTextEn", "Availability Badge (EN)"],
                  ["aboutContactNote", "联系栏底部说明 (中文)"],
                  ["aboutContactNoteEn", "Contact Note (EN)"],
                ].map(([key, label]) => (
                  <label key={key} className="space-y-1 block">
                    <span className="text-[var(--fg-muted)]">{label}</span>
                    <input
                      value={settingsForm[key] || ""}
                      onChange={(e) => {
                        setSettingsForm({ ...settingsForm, [key]: e.target.value });
                        setSettingsDirty(true);
                      }}
                      className={INPUT_CLS}
                    />
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                <label className="space-y-1 block">
                  <span className="text-[var(--fg-muted)]">个人创作自述 (中文，支持多段换行)</span>
                  <textarea
                    rows={4}
                    value={settingsForm.bio || ""}
                    onChange={(e) => {
                      setSettingsForm({ ...settingsForm, bio: e.target.value });
                      setSettingsDirty(true);
                    }}
                    className={INPUT_CLS}
                  />
                </label>
                <label className="space-y-1 block">
                  <span className="text-[var(--fg-muted)]">Statement / Biography (EN)</span>
                  <textarea
                    rows={4}
                    value={settingsForm.bioEn || ""}
                    onChange={(e) => {
                      setSettingsForm({ ...settingsForm, bioEn: e.target.value });
                      setSettingsDirty(true);
                    }}
                    className={INPUT_CLS}
                  />
                </label>
              </div>
            </section>

            {/* Focus Cards & Milestones Side-by-Side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <section className="surface-card rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[var(--fg)]">关于页 · 拍摄方向卡片</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setFocusList([...focusList, { icon: "compass", title: "", titleEn: "", desc: "", descEn: "" }]);
                      setSettingsDirty(true);
                    }}
                    className="inline-flex items-center gap-1 rounded border border-[var(--border)] px-2.5 py-1 hover:bg-[var(--bg-subtle)] cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" /> 添加
                  </button>
                </div>

                <div className="space-y-2.5">
                  {focusList.map((item, idx) => (
                    <div key={idx} className="rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)]/50 p-3 space-y-2">
                      <div className="grid grid-cols-5 gap-2">
                        <select
                          value={item.icon}
                          onChange={(e) => {
                            setFocusList(focusList.map((f, i) => (i === idx ? { ...f, icon: e.target.value } : f)));
                            setSettingsDirty(true);
                          }}
                          className={INPUT_CLS}
                        >
                          <option value="compass">指南针</option>
                          <option value="building">建筑</option>
                          <option value="aperture">光圈</option>
                          <option value="frame">画框</option>
                        </select>
                        <input
                          placeholder="中文标题"
                          value={item.title}
                          onChange={(e) => {
                            setFocusList(focusList.map((f, i) => (i === idx ? { ...f, title: e.target.value } : f)));
                            setSettingsDirty(true);
                          }}
                          className={`col-span-2 ${INPUT_CLS}`}
                        />
                        <input
                          placeholder="Title (EN)"
                          value={item.titleEn}
                          onChange={(e) => {
                            setFocusList(focusList.map((f, i) => (i === idx ? { ...f, titleEn: e.target.value } : f)));
                            setSettingsDirty(true);
                          }}
                          className={INPUT_CLS}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setFocusList(focusList.filter((_, i) => i !== idx));
                            setSettingsDirty(true);
                          }}
                          className="rounded border border-[var(--border)] text-[var(--fg-muted)] hover:text-red-400 cursor-pointer"
                        >
                          删除
                        </button>
                      </div>
                      <input
                        placeholder="卡片说明 (中文)"
                        value={item.desc}
                        onChange={(e) => {
                          setFocusList(focusList.map((f, i) => (i === idx ? { ...f, desc: e.target.value } : f)));
                          setSettingsDirty(true);
                        }}
                        className={INPUT_CLS}
                      />
                      <input
                        placeholder="Description (EN)"
                        value={item.descEn}
                        onChange={(e) => {
                          setFocusList(focusList.map((f, i) => (i === idx ? { ...f, descEn: e.target.value } : f)));
                          setSettingsDirty(true);
                        }}
                        className={INPUT_CLS}
                      />
                    </div>
                  ))}
                </div>
              </section>

              <section className="surface-card rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[var(--fg)]">关于页 · 展览与出版记录</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setMilestoneList([
                        ...milestoneList,
                        { year: String(new Date().getFullYear()), title: "", titleEn: "", place: "", placeEn: "" },
                      ]);
                      setSettingsDirty(true);
                    }}
                    className="inline-flex items-center gap-1 rounded border border-[var(--border)] px-2.5 py-1 hover:bg-[var(--bg-subtle)] cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" /> 添加
                  </button>
                </div>

                <div className="space-y-2.5">
                  {milestoneList.map((m, idx) => (
                    <div key={idx} className="rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)]/50 p-3 space-y-2">
                      <div className="grid grid-cols-5 gap-2">
                        <input
                          placeholder="年份"
                          value={m.year}
                          onChange={(e) => {
                            setMilestoneList(
                              milestoneList.map((x, i) => (i === idx ? { ...x, year: e.target.value } : x))
                            );
                            setSettingsDirty(true);
                          }}
                          className={INPUT_CLS}
                        />
                        <input
                          placeholder="中文标题"
                          value={m.title}
                          onChange={(e) => {
                            setMilestoneList(
                              milestoneList.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x))
                            );
                            setSettingsDirty(true);
                          }}
                          className={`col-span-3 ${INPUT_CLS}`}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setMilestoneList(milestoneList.filter((_, i) => i !== idx));
                            setSettingsDirty(true);
                          }}
                          className="rounded border border-[var(--border)] text-[var(--fg-muted)] hover:text-red-400 cursor-pointer"
                        >
                          删除
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          placeholder="地点/备注 (中文)"
                          value={m.place}
                          onChange={(e) => {
                            setMilestoneList(
                              milestoneList.map((x, i) => (i === idx ? { ...x, place: e.target.value } : x))
                            );
                            setSettingsDirty(true);
                          }}
                          className={INPUT_CLS}
                        />
                        <input
                          placeholder="Title / Place (EN)"
                          value={m.titleEn}
                          onChange={(e) => {
                            setMilestoneList(
                              milestoneList.map((x, i) => (i === idx ? { ...x, titleEn: e.target.value } : x))
                            );
                            setSettingsDirty(true);
                          }}
                          className={INPUT_CLS}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </form>
        </main>
      )}

      {mergeModal && (
        <div
          onClick={() => !mergingGroup && setMergeModal(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="surface-card flex max-h-[86dvh] w-full max-w-2xl flex-col rounded-2xl p-5 space-y-4 shadow-2xl text-xs"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] pb-3">
              <div className="space-y-0.5">
                <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--fg)]">
                  <Layers className="h-4 w-4 opacity-85" />
                  <span>合并为组图（共 {mergeModal.orderedIds.length} 幅）</span>
                </h3>
                <p className="text-[var(--fg-muted)]">
                  点击卡片选择要保留哪张作品的<strong>标题、描述、分类与地点坐标</strong>；右侧箭头可微调组内编号顺序（1 → {mergeModal.orderedIds.length}）。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMergeModal(null)}
                className="rounded-full p-1 text-[var(--fg-muted)] hover:text-[var(--fg)] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {mergeModal.orderedIds.map((pid, idx) => {
                const p = photoMap.get(pid);
                if (!p) return null;
                const isMetaSource = mergeModal.metadataFromId === pid;
                return (
                  <div
                    key={pid}
                    onClick={() => setMergeModal({ ...mergeModal, metadataFromId: pid })}
                    className={`flex items-start justify-between gap-3 rounded-xl border p-3 transition cursor-pointer ${
                      isMetaSource
                        ? "border-[var(--fg)] bg-[var(--bg-subtle)] ring-1 ring-[var(--fg)]"
                        : "border-[var(--border)] hover:border-[var(--fg-muted)]"
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-md bg-[var(--bg-subtle)]">
                        <img
                          src={optImg(p.url, 256, 75)}
                          loading="lazy"
                          decoding="async"
                          alt=""
                          className="h-full w-full object-contain"
                        />
                        <span className="absolute left-1.5 top-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          #{idx + 1}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-sm text-[var(--fg)] truncate">
                            {p.title || "未命名"}
                          </span>
                          {p.location && (
                            <span className="inline-flex items-center gap-0.5 text-[11px] text-[var(--fg-muted)]">
                              <MapPin className="h-3 w-3" />
                              {p.location}
                            </span>
                          )}
                          {isMetaSource && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                              <Check className="h-3 w-3" /> 保留此张描述与信息
                            </span>
                          )}
                        </div>
                        <p className="line-clamp-2 text-[11px] leading-relaxed text-[var(--fg-muted)]">
                          {p.description ? p.description : "（该照片暂无文字描述）"}
                        </p>
                      </div>
                    </div>

                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 shrink-0 pt-1"
                    >
                      <button
                        type="button"
                        disabled={idx === 0}
                        title="组内前移"
                        onClick={() => {
                          const next = [...mergeModal.orderedIds];
                          [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                          setMergeModal({ ...mergeModal, orderedIds: next });
                        }}
                        className="rounded border border-[var(--border)] p-1 text-[var(--fg-muted)] hover:text-[var(--fg)] disabled:opacity-25 cursor-pointer"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === mergeModal.orderedIds.length - 1}
                        title="组内后移"
                        onClick={() => {
                          const next = [...mergeModal.orderedIds];
                          [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                          setMergeModal({ ...mergeModal, orderedIds: next });
                        }}
                        className="rounded border border-[var(--border)] p-1 text-[var(--fg-muted)] hover:text-[var(--fg)] disabled:opacity-25 cursor-pointer"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] pt-3">
              <button
                type="button"
                disabled={mergingGroup}
                onClick={() => setMergeModal(null)}
                className="rounded-md border border-[var(--border)] px-4 py-1.5 text-[var(--fg-muted)] hover:text-[var(--fg)] cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                disabled={mergingGroup}
                onClick={confirmMergeGroup}
                className="rounded-md bg-[var(--fg)] px-5 py-1.5 font-medium text-[var(--bg)] hover:opacity-90 cursor-pointer"
              >
                {mergingGroup ? "合并中…" : `确认合并（共 ${mergeModal.orderedIds.length} 幅）`}
              </button>
            </div>
          </div>
        </div>
      )}

      {cropModal && (
        <ImageCropModal
          imageSrc={cropModal.src}
          mode={cropModal.mode}
          previewTitle={resolveSiteTitle(settingsForm)}
          onCancel={closeCropModal}
          onApply={applyCroppedBrandImage}
        />
      )}
    </div>
  );
}
