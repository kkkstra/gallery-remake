"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Activity,
  Aperture,
  Calendar,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  Download,
  ExternalLink,
  Focus,
  Frame,
  Gauge,
  Info,
  Layers,
  MapPin,
  Maximize,
  Maximize2,
  Minimize,
  Palette,
  Pause,
  Play,
  ScanSearch,
  Share2,
  Tag,
  Timer,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { Photo } from "@/lib/db/schema";
import { ViewLink } from "./ViewLink";
import { PrintCardModal } from "./PrintCardModal";
import { PhotoMiniMap } from "./PhotoMiniMap";
import { usePreferences } from "./PreferencesProvider";

const LOUPE_SIZE = 204;
const LOUPE_ZOOM = 3;

interface HistogramData {
  r: number[];
  g: number[];
  b: number[];
  lum: number[];
  swatches: string[];
}

function smoothPath(bins: number[], w = 280, h = 64): string {
  const pts = bins.map(
    (v, i) => `${((i / (bins.length - 1)) * w).toFixed(1)},${(h - v * (h - 4)).toFixed(1)}`
  );
  return `M0,${h} L${pts.join(" L")} L${w},${h} Z`;
}

function extractDistinctSwatches(data: Uint8ClampedArray): string[] {
  const buckets = new Map<string, { r: number; g: number; b: number; count: number }>();
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
    const prev = buckets.get(key);
    if (prev) {
      prev.r += r;
      prev.g += g;
      prev.b += b;
      prev.count += 1;
    } else {
      buckets.set(key, { r, g, b, count: 1 });
    }
  }

  const sorted = Array.from(buckets.values())
    .map((b) => ({
      r: Math.round(b.r / b.count),
      g: Math.round(b.g / b.count),
      b: Math.round(b.b / b.count),
      count: b.count,
    }))
    .sort((a, b) => b.count - a.count);

  const chosen: { r: number; g: number; b: number }[] = [];
  for (const cand of sorted) {
    const distinct = chosen.every(
      (c) => Math.hypot(c.r - cand.r, c.g - cand.g, c.b - cand.b) > 42
    );
    if (distinct) chosen.push(cand);
    if (chosen.length === 5) break;
  }

  return chosen
    .sort((a, b) => 0.299 * a.r + 0.587 * a.g + 0.114 * a.b - (0.299 * b.r + 0.587 * b.g + 0.114 * b.b))
    .map(
      (c) =>
        `#${[c.r, c.g, c.b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("")}`
    );
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
  photographerName?: string;
  photographerNameEn?: string;
  onClose: () => void;
  onChangeIndex: (index: number) => void;
}

export function Lightbox({
  photos,
  activeIndex,
  collectionsMap,
  photographerName,
  photographerNameEn,
  onClose,
  onChangeIndex,
}: LightboxProps) {
  const { locale, theme, copyrightGuard, pick, categoryLabel } = usePreferences();
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [showPanel, setShowPanel] = useState(true);
  const [matted, setMatted] = useState(false);
  const [loupeMode, setLoupeMode] = useState(false);
  const [shiftHeld, setShiftHeld] = useState(false);
  const [loupePos, setLoupePos] = useState<{
    stageX: number;
    stageY: number;
    bgX: number;
    bgY: number;
    bgW: number;
    bgH: number;
  } | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [copiedHex, setCopiedHex] = useState<string | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);
  const [prevPhotoUrl, setPrevPhotoUrl] = useState<string | null>(null);
  const [hist, setHist] = useState<HistogramData | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const morphTargetRef = useRef<HTMLDivElement>(null);
  const mainImgRef = useRef<HTMLImageElement>(null);
  const filmstripRef = useRef<HTMLDivElement>(null);
  const [filmScroll, setFilmScroll] = useState({ canLeft: false, canRight: false, hasOverflow: false });
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const lastLoadedUrlRef = useRef<string | null>(null);
  const wasOpenRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number; moved: boolean } | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{
    dist0: number;
    scale0: number;
    midX0: number;
    midY0: number;
    panX0: number;
    panY0: number;
  } | null>(null);
  const lastTapRef = useRef<{ time: number; x: number; y: number }>({ time: 0, x: 0, y: 0 });

  const isDark = theme === "dark";
  const photo = activeIndex !== null ? photos[activeIndex] : null;
  const isZoomed = scale > 1.02;
  const loupeEnabled = (loupeMode || shiftHeld) && !isZoomed && !closing && !showPrintModal;

  const resetZoom = useCallback(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
    setDragging(false);
  }, []);

  const syncLoupeAt = useCallback((clientX: number, clientY: number) => {
    const stageEl = stageRef.current;
    const imgEl = mainImgRef.current;
    if (!stageEl || !imgEl) {
      setLoupePos(null);
      return;
    }
    const imgRect = imgEl.getBoundingClientRect();
    if (
      imgRect.width <= 0 ||
      clientX < imgRect.left ||
      clientX > imgRect.right ||
      clientY < imgRect.top ||
      clientY > imgRect.bottom
    ) {
      setLoupePos(null);
      return;
    }
    const stageRect = stageEl.getBoundingClientRect();
    const u = (clientX - imgRect.left) / imgRect.width;
    const v = (clientY - imgRect.top) / imgRect.height;
    const bgW = imgRect.width * LOUPE_ZOOM;
    const bgH = imgRect.height * LOUPE_ZOOM;
    setLoupePos({
      stageX: clientX - stageRect.left - LOUPE_SIZE / 2,
      stageY: clientY - stageRect.top - LOUPE_SIZE / 2,
      bgX: LOUPE_SIZE / 2 - u * bgW,
      bgY: LOUPE_SIZE / 2 - v * bgH,
      bgW,
      bgH,
    });
  }, []);

  const syncFilmScroll = useCallback(() => {
    const el = filmstripRef.current;
    if (!el) return;
    const hasOverflow = el.scrollWidth > el.clientWidth + 4;
    setFilmScroll({
      hasOverflow,
      canLeft: el.scrollLeft > 4,
      canRight: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, []);

  const scrollFilmBy = useCallback((delta: number) => {
    filmstripRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  }, []);

  useEffect(() => {
    resetZoom();
    setLoupePos(null);
    pointersRef.current.clear();
    pinchRef.current = null;
    if (activeIndex === null) {
      lastLoadedUrlRef.current = null;
      setPrevPhotoUrl(null);
      return;
    }

    const nextUrl = photos[activeIndex]?.url;
    if (lastLoadedUrlRef.current && lastLoadedUrlRef.current !== nextUrl) {
      setPrevPhotoUrl(lastLoadedUrlRef.current);
    }

    // Silently warm up adjacent images (±1, +2) so switching has zero blank flash
    if (photos.length > 1) {
      const offsets = [-1, 1, 2];
      offsets.forEach((off) => {
        const target = photos[(activeIndex + off + photos.length) % photos.length];
        if (target?.url) {
          const pre = new Image();
          pre.src = target.url;
        }
      });
    }

    const id = requestAnimationFrame(() => {
      if (mainImgRef.current?.complete && nextUrl) {
        lastLoadedUrlRef.current = nextUrl;
        setPrevPhotoUrl(null);
      }
      const activeThumb = filmstripRef.current?.querySelector<HTMLElement>('[data-film-active="true"]');
      activeThumb?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      syncFilmScroll();
    });
    return () => cancelAnimationFrame(id);
  }, [activeIndex, photos, resetZoom, syncFilmScroll]);

  useEffect(() => {
    if (activeIndex === null) return;
    const id = setTimeout(syncFilmScroll, 90);
    window.addEventListener("resize", syncFilmScroll);
    return () => {
      clearTimeout(id);
      window.removeEventListener("resize", syncFilmScroll);
    };
  }, [activeIndex, showPanel, syncFilmScroll]);

  useEffect(() => {
    if (!loupeEnabled) {
      setLoupePos(null);
    } else if (lastPointerRef.current) {
      syncLoupeAt(lastPointerRef.current.x, lastPointerRef.current.y);
    }
  }, [loupeEnabled, syncLoupeAt]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Auto-advancing exhibition slideshow
  useEffect(() => {
    if (!playing || activeIndex === null || photos.length <= 1) return;
    const id = setInterval(() => {
      onChangeIndex((activeIndex + 1) % photos.length);
    }, 4000);
    return () => clearInterval(id);
  }, [activeIndex, onChangeIndex, photos.length, playing]);

  // Shared-Element Fly-In when opening Lightbox from any thumbnail
  useLayoutEffect(() => {
    if (activeIndex === null || !photo) {
      wasOpenRef.current = false;
      setClosing(false);
      setPlaying(false);
      return;
    }

    if (!wasOpenRef.current) {
      wasOpenRef.current = true;
      if (window.innerWidth < 1024) {
        setShowPanel(false);
      }
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const targetEl = morphTargetRef.current;
      const originEl = document.querySelector<HTMLElement>(`img[data-morph-photo-id="${photo.id}"]`);
      if (targetEl && originEl) {
        const originRect = originEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();
        if (originRect.width > 0 && targetRect.width > 0) {
          const dx = originRect.left + originRect.width / 2 - (targetRect.left + targetRect.width / 2);
          const dy = originRect.top + originRect.height / 2 - (targetRect.top + targetRect.height / 2);
          const s0 = Math.max(
            0.12,
            Math.min(originRect.width / targetRect.width, originRect.height / targetRect.height)
          );
          targetEl.animate(
            [
              { transform: `translate3d(${dx}px, ${dy}px, 0) scale(${s0})` },
              { transform: "translate3d(0, 0, 0) scale(1)" },
            ],
            { duration: 380, easing: "cubic-bezier(0.2, 0.9, 0.25, 1)" }
          );
        }
      }
    }
  }, [activeIndex, photo]);

  // Shared-Element Fly-Back to original cell on Close
  const requestClose = useCallback(() => {
    if (closing) return;
    setPlaying(false);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }

    if (
      !photo ||
      isZoomed ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      onClose();
      return;
    }

    const targetEl = morphTargetRef.current;
    const originEl = document.querySelector<HTMLElement>(`img[data-morph-photo-id="${photo.id}"]`);
    if (targetEl && originEl) {
      const originRect = originEl.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      if (
        originRect.width > 0 &&
        targetRect.width > 0 &&
        originRect.bottom > 0 &&
        originRect.top < window.innerHeight
      ) {
        setClosing(true);
        const dx = originRect.left + originRect.width / 2 - (targetRect.left + targetRect.width / 2);
        const dy = originRect.top + originRect.height / 2 - (targetRect.top + targetRect.height / 2);
        const s1 = Math.max(
          0.12,
          Math.min(originRect.width / targetRect.width, originRect.height / targetRect.height)
        );
        const anim = targetEl.animate(
          [
            { transform: "translate3d(0, 0, 0) scale(1)", opacity: 1 },
            { transform: `translate3d(${dx}px, ${dy}px, 0) scale(${s1})`, opacity: 0.88 },
          ],
          { duration: 270, easing: "cubic-bezier(0.32, 0, 0.2, 1)", fill: "forwards" }
        );
        anim.onfinish = () => {
          setClosing(false);
          onClose();
        };
        return;
      }
    }

    onClose();
  }, [closing, isZoomed, onClose, photo]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      rootRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (activeIndex === null) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShiftHeld(true);
      if (showPrintModal) return;
      if (e.key === "Escape") requestClose();
      if (e.key === "ArrowLeft") onChangeIndex((activeIndex - 1 + photos.length) % photos.length);
      if (e.key === "ArrowRight") onChangeIndex((activeIndex + 1) % photos.length);
      if (e.key.toLowerCase() === "i") setShowPanel((v) => !v);
      if (e.key.toLowerCase() === "m") setMatted((v) => !v);
      if (e.key.toLowerCase() === "l") {
        resetZoom();
        setLoupeMode((v) => !v);
      }
      if (e.key.toLowerCase() === "p") setShowPrintModal(true);
      if (e.key.toLowerCase() === "f") toggleFullscreen();
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShiftHeld(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [activeIndex, onChangeIndex, photos.length, requestClose, resetZoom, showPrintModal, toggleFullscreen]);

  // Compute Histogram + 5-Color Palette Swatches in one pass
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
        const swatches = extractDistinctSwatches(data);
        setHist({
          r: r.map((v) => v / peak),
          g: g.map((v) => v / peak),
          b: b.map((v) => v / peak),
          lum: lum.map((v) => v / peak),
          swatches,
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

  const zoomToPoint = (clientX: number, clientY: number, targetScale: number, imgEl: HTMLImageElement) => {
    const r = imgEl.getBoundingClientRect();
    const ox = clientX - (r.left + r.width / 2);
    const oy = clientY - (r.top + r.height / 2);
    setScale(targetScale);
    setPan({ x: -ox * (targetScale - 1), y: -oy * (targetScale - 1) });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLImageElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2) {
      const [p1, p2] = Array.from(pointersRef.current.values());
      dragStartRef.current = null;
      setDragging(true);
      pinchRef.current = {
        dist0: Math.max(20, Math.hypot(p2.x - p1.x, p2.y - p1.y)),
        scale0: scale,
        midX0: (p1.x + p2.x) / 2,
        midY0: (p1.y + p2.y) / 2,
        panX0: pan.x,
        panY0: pan.y,
      };
      return;
    }

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
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const [p1, p2] = Array.from(pointersRef.current.values());
      const dist = Math.max(12, Math.hypot(p2.x - p1.x, p2.y - p1.y));
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      const nextScale = Math.min(4, Math.max(0.92, pinchRef.current.scale0 * (dist / pinchRef.current.dist0)));
      const ratio = nextScale / pinchRef.current.scale0;
      setScale(nextScale);
      setPan({
        x: pinchRef.current.panX0 * ratio + (midX - pinchRef.current.midX0),
        y: pinchRef.current.panY0 * ratio + (midY - pinchRef.current.midY0),
      });
      return;
    }

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
    pointersRef.current.delete(e.pointerId);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    if (pinchRef.current) {
      if (pointersRef.current.size < 2) {
        pinchRef.current = null;
        setDragging(false);
        setScale((s) => {
          if (s <= 1.04) {
            setPan({ x: 0, y: 0 });
            return 1;
          }
          return Number(s.toFixed(2));
        });
      }
      return;
    }

    const start = dragStartRef.current;
    dragStartRef.current = null;
    setDragging(false);
    if (!start) return;

    if (start.moved && !isZoomed && !loupeEnabled) {
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.25 && photos.length > 1) {
        onChangeIndex(
          dx < 0
            ? (activeIndex + 1) % photos.length
            : (activeIndex - 1 + photos.length) % photos.length
        );
        return;
      }
      if (e.pointerType === "touch" && dy > 76 && Math.abs(dy) > Math.abs(dx) * 1.4) {
        requestClose();
        return;
      }
    }

    if (!start.moved) {
      if (loupeEnabled) return;
      if (e.pointerType === "touch") {
        const now = Date.now();
        const prevTap = lastTapRef.current;
        if (now - prevTap.time < 300 && Math.hypot(e.clientX - prevTap.x, e.clientY - prevTap.y) < 36) {
          lastTapRef.current = { time: 0, x: 0, y: 0 };
          if (isZoomed) resetZoom();
          else zoomToPoint(e.clientX, e.clientY, 2.4, e.currentTarget);
        } else {
          lastTapRef.current = { time: now, x: e.clientX, y: e.clientY };
        }
        return;
      }
      if (isZoomed) resetZoom();
      else zoomToPoint(e.clientX, e.clientY, 2.2, e.currentTarget);
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

  const copySwatch = (hex: string) => {
    navigator.clipboard?.writeText(hex).catch(() => {});
    setCopiedHex(hex);
    setTimeout(() => setCopiedHex(null), 1500);
  };

  const handleSharePhoto = async () => {
    if (!photo) return;
    const shareUrl = `${window.location.origin}/photo/${photo.id}`;
    if (typeof navigator.share === "function" && window.matchMedia("(max-width: 768px)").matches) {
      try {
        await navigator.share({ title: pick(photo.title, photo.titleEn), url: shareUrl });
        return;
      } catch {
        // Fallback to copy
      }
    }
    navigator.clipboard?.writeText(shareUrl).catch(() => {});
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 1800);
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
      ref={rootRef}
      className="fixed inset-0 z-50 flex flex-col lg:flex-row text-[var(--fg)] select-none"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Translucent Frosted Glass Backdrop (fades smoothly during fly-back close) */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 -z-10 backdrop-blur-2xl backdrop-saturate-180 transition-opacity duration-260 ${
          closing ? "opacity-0" : "opacity-100 animate-lightbox-in"
        } ${isDark ? "bg-[#090a0e]/84" : "bg-[#f4f6fa]/84"}`}
      />
      {/* Slideshow Hairline Progress Indicator */}
      {playing && !closing && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-[2px] bg-[var(--border)] overflow-hidden">
          <div
            key={`${photo.id}-${playing}`}
            className="h-full w-full origin-left bg-[var(--fg)] animate-slideshow-bar"
          />
        </div>
      )}

      {/* Left/Center Photo Canvas */}
      <div className="relative flex flex-1 min-w-0 min-h-0 flex-col justify-between">
        <div
          className={`flex items-center justify-between gap-2 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-2xl px-3.5 pt-[max(0.625rem,env(safe-area-inset-top))] pb-2.5 sm:px-6 sm:py-3 text-xs sm:text-sm z-20 transition-opacity duration-200 ${
            closing ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
        >
          <div className="flex min-w-0 items-center gap-2 text-[var(--fg-muted)]">
            <span className="shrink-0 font-semibold text-[var(--fg)]">
              {String(activeIndex + 1).padStart(2, "0")} / {String(photos.length).padStart(2, "0")}
            </span>
            {place && (
              <>
                <span className="hidden min-[390px]:inline opacity-40">·</span>
                <span className="hidden min-[390px]:inline-flex min-w-0 items-center gap-1 truncate">
                  <MapPin className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  <span className="truncate">{place}</span>
                </span>
              </>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1 text-[var(--fg-muted)]">
            {isZoomed && (
              <button
                type="button"
                onClick={resetZoom}
                title="点击还原 100%"
                className="rounded border border-[var(--border)] px-1.5 sm:px-2 py-0.5 text-[11px] sm:text-xs font-medium text-[var(--fg)] hover:opacity-80 transition mr-0.5 cursor-pointer"
              >
                {Math.round(scale * 100)}%
              </button>
            )}

            <button
              type="button"
              onClick={zoomOutStep}
              disabled={!isZoomed}
              title={locale === "en" ? "Zoom Out" : "缩小"}
              aria-label="缩小"
              className="p-1.5 sm:p-2 rounded-full hover:bg-[var(--bg-subtle)] hover:text-[var(--fg)] disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
            >
              <ZoomOut className="h-[17px] w-[17px] sm:h-[18px] sm:w-[18px] stroke-[1.6]" />
            </button>
            <button
              type="button"
              onClick={zoomInStep}
              disabled={scale >= 4}
              title={locale === "en" ? "Zoom In (Drag to pan)" : "放大（放大后可拖拽移动）"}
              aria-label="放大"
              className="p-1.5 sm:p-2 rounded-full hover:bg-[var(--bg-subtle)] hover:text-[var(--fg)] disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
            >
              <ZoomIn className="h-[17px] w-[17px] sm:h-[18px] sm:w-[18px] stroke-[1.6]" />
            </button>

            {/* 3x Optical Loupe Toggle (Desktop Pointer) */}
            <button
              type="button"
              onClick={() => {
                resetZoom();
                setLoupeMode((v) => !v);
              }}
              title={
                locale === "en"
                  ? "3x Optical Loupe (L or hold Shift)"
                  : "3x 光学放大镜（快捷键 L 或按住 Shift）"
              }
              aria-label="切换 3x 光学放大镜"
              className={`hidden sm:inline-flex p-2 rounded-full transition cursor-pointer ${
                loupeMode
                  ? "bg-[var(--fg)] text-[var(--bg)]"
                  : "hover:bg-[var(--bg-subtle)] hover:text-[var(--fg)]"
              }`}
            >
              <ScanSearch className="h-[18px] w-[18px] stroke-[1.6]" />
            </button>

            <span className="mx-0.5 sm:mx-1 h-4 w-[1px] bg-[var(--border)]" />

            {/* White Museum Mat Frame Toggle */}
            <button
              type="button"
              onClick={() => setMatted((m) => !m)}
              title={locale === "en" ? "Museum Mat Frame (M)" : "白卡纸装裱模式 (M)"}
              aria-label="切换白卡纸装裱"
              className={`p-1.5 sm:p-2 rounded-full transition cursor-pointer ${
                matted
                  ? "bg-[var(--fg)] text-[var(--bg)]"
                  : "hover:bg-[var(--bg-subtle)] hover:text-[var(--fg)]"
              }`}
            >
              <Frame className="h-[17px] w-[17px] sm:h-[18px] sm:w-[18px] stroke-[1.6]" />
            </button>

            {/* Slideshow Play/Pause */}
            {photos.length > 1 && (
              <button
                type="button"
                onClick={() => setPlaying((p) => !p)}
                title={locale === "en" ? "Slideshow (Space)" : "幻灯片自动放映 (空格)"}
                aria-label={playing ? "暂停放映" : "自动放映"}
                className={`p-1.5 sm:p-2 rounded-full transition cursor-pointer ${
                  playing
                    ? "bg-[var(--fg)] text-[var(--bg)]"
                    : "hover:bg-[var(--bg-subtle)] hover:text-[var(--fg)]"
                }`}
              >
                {playing ? (
                  <Pause className="h-[17px] w-[17px] sm:h-[18px] sm:w-[18px] stroke-[1.6]" />
                ) : (
                  <Play className="h-[17px] w-[17px] sm:h-[18px] sm:w-[18px] stroke-[1.6]" />
                )}
              </button>
            )}

            {/* True Browser Fullscreen */}
            <button
              type="button"
              onClick={toggleFullscreen}
              title={locale === "en" ? "Fullscreen (F)" : "浏览器全屏 (F)"}
              aria-label="全屏模式"
              className="hidden sm:inline-flex p-2 rounded-full hover:bg-[var(--bg-subtle)] hover:text-[var(--fg)] transition cursor-pointer"
            >
              {isFullscreen ? (
                <Minimize className="h-[18px] w-[18px] stroke-[1.6]" />
              ) : (
                <Maximize className="h-[18px] w-[18px] stroke-[1.6]" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowPanel((v) => !v)}
              title={showPanel ? "收起信息栏 (I)" : "展开信息栏 (I)"}
              aria-label="切换信息栏"
              className={`p-1.5 sm:p-2 rounded-full hover:bg-[var(--bg-subtle)] transition cursor-pointer ${
                showPanel ? "text-[var(--fg)]" : "hover:text-[var(--fg)]"
              }`}
            >
              <Info className="h-[17px] w-[17px] sm:h-[18px] sm:w-[18px] stroke-[1.6]" />
            </button>

            <button
              type="button"
              onClick={requestClose}
              title="关闭 (Esc)"
              aria-label="关闭灯箱"
              className="p-1.5 sm:p-2 rounded-full hover:bg-[var(--bg-subtle)] hover:text-[var(--fg)] transition cursor-pointer"
            >
              <X className="h-[19px] w-[19px] sm:h-5 sm:w-5 stroke-[1.6]" />
            </button>
          </div>
        </div>

        <div
          ref={stageRef}
          onWheel={handleStageWheel}
          onPointerMove={(e) => {
            lastPointerRef.current = { x: e.clientX, y: e.clientY };
            if (loupeEnabled) syncLoupeAt(e.clientX, e.clientY);
          }}
          onPointerLeave={() => setLoupePos(null)}
          className="relative flex flex-1 min-h-0 items-center justify-center overflow-hidden px-3 sm:px-20 py-2"
        >
          {/* Subtle Restrained Stage Depth behind the Photograph */}
          {!closing && (
            <img
              key={`glow-${photo.id}`}
              src={photo.url}
              alt=""
              aria-hidden="true"
              className={`pointer-events-none absolute inset-0 m-auto h-[64%] w-[64%] object-cover blur-[90px] saturate-125 transition-opacity duration-700 ${
                isDark ? "opacity-14" : "opacity-12"
              }`}
            />
          )}

          {photos.length > 1 && !closing && (
            <button
              type="button"
              onClick={() => onChangeIndex((activeIndex - 1 + photos.length) % photos.length)}
              aria-label="上一张"
              className="hidden sm:inline-flex absolute left-3.5 z-20 h-11 w-11 items-center justify-center rounded-full text-[var(--fg-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg)] transition cursor-pointer"
            >
              <ChevronLeft className="h-6 w-6 stroke-[1.6]" />
            </button>
          )}

          {/* Shared-Element Morph Wrapper + Optional Museum Acid-Free White Mat */}
          <div
            ref={morphTargetRef}
            onContextMenu={(e) => {
              if (copyrightGuard) e.preventDefault();
            }}
            className={`relative z-10 flex max-h-full max-w-full items-center justify-center transition-[padding,background-color,box-shadow] duration-300 ${
              matted && !isZoomed
                ? "bg-[#F7F6F1] p-3.5 sm:p-9 shadow-[0_24px_64px_rgba(0,0,0,0.45)] ring-1 ring-black/10"
                : ""
            }`}
          >
            {/* Zero-Flash Previous Frame Underlay while Next Image Decodes */}
            {prevPhotoUrl && !isZoomed && (
              <img
                src={prevPhotoUrl}
                alt=""
                aria-hidden="true"
                className={`pointer-events-none absolute inset-0 m-auto object-contain opacity-65 blur-[2px] max-w-full ${
                  matted ? "max-h-[66dvh] sm:max-h-[64dvh]" : "max-h-[76dvh] sm:max-h-[75dvh]"
                }`}
              />
            )}

            <img
              ref={mainImgRef}
              key={photo.id}
              src={photo.url}
              alt={title}
              draggable={false}
              onLoad={() => {
                lastLoadedUrlRef.current = photo.url;
                setPrevPhotoUrl(null);
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              style={{
                transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale})`,
                transition: dragging ? "none" : "transform 240ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
              className={`object-contain touch-none animate-photo-switch max-w-full ${
                matted && !isZoomed ? "max-h-[66dvh] sm:max-h-[64dvh]" : "max-h-[76dvh] sm:max-h-[75dvh]"
              } ${
                loupeEnabled && loupePos
                  ? "cursor-none"
                  : isZoomed
                  ? dragging
                    ? "cursor-grabbing"
                    : "cursor-grab"
                  : "cursor-zoom-in"
              }`}
            />
          </div>

          {/* 3.0x High-Refraction Optical Glass Loupe */}
          {loupeEnabled && loupePos && (
            <div
              aria-hidden="true"
              style={{
                width: LOUPE_SIZE,
                height: LOUPE_SIZE,
                transform: `translate3d(${loupePos.stageX}px, ${loupePos.stageY}px, 0)`,
                backgroundImage: `url(${photo.url})`,
                backgroundRepeat: "no-repeat",
                backgroundSize: `${loupePos.bgW}px ${loupePos.bgH}px`,
                backgroundPosition: `${loupePos.bgX}px ${loupePos.bgY}px`,
              }}
              className="pointer-events-none absolute left-0 top-0 z-30 rounded-full border border-white/55 shadow-[0_22px_54px_rgba(0,0,0,0.68),inset_0_0_20px_rgba(255,255,255,0.22),0_0_0_1px_rgba(0,0,0,0.45)]"
            >
              {/* Subtle Optical Reticle Crosshair */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="h-3.5 w-[1px] bg-white/55 mix-blend-difference" />
                <span className="absolute h-[1px] w-3.5 bg-white/55 mix-blend-difference" />
              </div>
              {/* Bottom Optical Magnification Tag */}
              <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium tracking-wider text-white/90 backdrop-blur-md">
                3.0×
              </span>
            </div>
          )}

          {photos.length > 1 && !closing && (
            <button
              type="button"
              onClick={() => onChangeIndex((activeIndex + 1) % photos.length)}
              aria-label="下一张"
              className="hidden sm:inline-flex absolute right-3.5 z-20 h-11 w-11 items-center justify-center rounded-full text-[var(--fg-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg)] transition cursor-pointer"
            >
              <ChevronRight className="h-6 w-6 stroke-[1.6]" />
            </button>
          )}
        </div>

        {/* Flush Frosted Glass Bottom Filmstrip with Wheel + Left/Right Arrow Scroll */}
        {photos.length > 1 && (
          <div
            className={`flex items-center gap-2 border-t border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-2xl px-2.5 sm:px-5 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:py-2.5 z-20 transition-opacity duration-200 ${
              closing ? "opacity-0 pointer-events-none" : "opacity-100"
            }`}
          >
            {filmScroll.hasOverflow && (
              <button
                type="button"
                onClick={() => scrollFilmBy(-320)}
                disabled={!filmScroll.canLeft}
                aria-label={locale === "en" ? "Scroll filmstrip left" : "向左滑动缩略图"}
                className="hidden sm:flex h-8 w-8 shrink-0 items-center justify-center rounded text-[var(--fg-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg)] disabled:opacity-20 disabled:pointer-events-none transition cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}

            <div
              ref={filmstripRef}
              onScroll={syncFilmScroll}
              onWheel={(e) => {
                const el = filmstripRef.current;
                if (!el) return;
                const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
                if (delta !== 0) {
                  e.preventDefault();
                  e.stopPropagation();
                  el.scrollLeft += delta;
                }
              }}
              className="flex-1 min-w-0 overflow-x-auto no-scrollbar"
            >
              <div className="mx-auto flex w-max items-center gap-1.5 sm:gap-2 px-1 py-0.5">
                {photos.map((item, idx) => {
                  const active = idx === activeIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-film-active={active ? "true" : undefined}
                      onClick={() => onChangeIndex(idx)}
                      className={`h-10 w-14 sm:h-11 sm:w-16 shrink-0 rounded-xs overflow-hidden transition-all duration-200 cursor-pointer ${
                        active ? "opacity-100 ring-2 ring-[var(--fg)]" : "opacity-40 hover:opacity-80"
                      }`}
                    >
                      <img src={item.url} alt={item.title} className="h-full w-full object-cover" />
                    </button>
                  );
                })}
              </div>
            </div>

            {filmScroll.hasOverflow && (
              <button
                type="button"
                onClick={() => scrollFilmBy(320)}
                disabled={!filmScroll.canRight}
                aria-label={locale === "en" ? "Scroll filmstrip right" : "向右滑动缩略图"}
                className="hidden sm:flex h-8 w-8 shrink-0 items-center justify-center rounded text-[var(--fg-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg)] disabled:opacity-20 disabled:pointer-events-none transition cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Right Frosted Glass Inspector — NOTE: Keep lg:w-96 frozen during `closing` so stage center NEVER shifts mid-flyback! */}
      <div
        aria-hidden={!showPanel || closing}
        className={`shrink-0 overflow-hidden z-20 transition-[width,max-height,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
          showPanel
            ? "max-h-[48dvh] lg:max-h-none lg:w-96"
            : "max-h-0 lg:max-h-none lg:w-0 pointer-events-none"
        } ${showPanel && !closing ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        <aside
          className={`w-full lg:w-96 h-full border-t lg:border-t-0 lg:border-l border-[var(--glass-border)] bg-[var(--glass-strong)] backdrop-blur-2xl backdrop-saturate-180 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-7 sm:py-6 flex flex-col justify-between gap-5 sm:gap-6 overflow-y-auto transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
            showPanel && !closing ? "translate-y-0 lg:translate-x-0" : "translate-y-4 lg:translate-y-0 lg:translate-x-8"
          }`}
        >
          <div className="space-y-5">
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--fg-muted)]">
                <span className="inline-flex items-center gap-1">
                  <Tag className="h-3.5 w-3.5 opacity-75" />
                  {categoryLabel(photo.category)}
                </span>
                {belongingCols.map((c) => (
                  <ViewLink
                    key={c.slug}
                    href={`/collections/${c.slug}`}
                    onClick={onClose}
                    className="inline-flex items-center gap-1 text-[var(--fg)] underline underline-offset-4 decoration-[var(--border)] hover:opacity-80"
                  >
                    <Layers className="h-3.5 w-3.5 opacity-75" />
                    {pick(c.title, c.titleEn)}
                  </ViewLink>
                ))}
              </div>

              <div>
                <h2 className="text-xl font-semibold text-[var(--fg)] leading-snug">{title}</h2>
                {subtitle && subtitle !== title && (
                  <p className="mt-0.5 text-sm text-[var(--fg-muted)]">{subtitle}</p>
                )}
              </div>

              {desc && (
                <p className="pt-0.5 text-sm leading-relaxed text-[var(--fg-muted)] select-text">
                  {desc}
                </p>
              )}
            </div>

            {/* Histogram + 5-Color Extracted Palette Swatches */}
            {hist && (
              <div className="space-y-3.5 border-t border-[var(--border)] pt-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-[var(--fg-muted)]">
                    <span className="inline-flex items-center gap-1.5">
                      <Activity className="h-3.5 w-3.5" />
                      {locale === "en" ? "Histogram" : "直方图"}
                    </span>
                    <span>RGB · Luma</span>
                  </div>
                  <svg viewBox="0 0 280 64" className="h-15 w-full overflow-visible" aria-label="直方图">
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

                {hist.swatches.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs text-[var(--fg-muted)]">
                      <span className="inline-flex items-center gap-1.5">
                        <Palette className="h-3.5 w-3.5" />
                        {locale === "en" ? "Color Palette" : "色彩构成"}
                      </span>
                      {copiedHex && (
                        <span className="text-[11px] text-[var(--fg)]">{copiedHex} ✓</span>
                      )}
                    </div>
                    <div className="flex h-6 w-full overflow-hidden rounded-md ring-1 ring-[var(--border)]">
                      {hist.swatches.map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => copySwatch(hex)}
                          title={hex.toUpperCase()}
                          style={{ backgroundColor: hex }}
                          className="group/sw relative flex-1 transition-all duration-200 hover:flex-[1.5] cursor-pointer"
                        >
                          {copiedHex === hex && (
                            <Check className="mx-auto h-3 w-3 text-white drop-shadow" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
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
                        <ViewLink
                          href={`/gallery?camera=${encodeURIComponent(photo.camera)}`}
                          onClick={onClose}
                          className="hover:underline underline-offset-4"
                        >
                          {photo.camera}
                        </ViewLink>
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
                        <ViewLink
                          href={`/gallery?lens=${encodeURIComponent(photo.lens)}`}
                          onClick={onClose}
                          className="hover:underline underline-offset-4"
                        >
                          {photo.lens}
                        </ViewLink>
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

              <dl className="space-y-2 text-sm">
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

              {photo.lat !== null && photo.lng !== null && (
                <PhotoMiniMap
                  photoId={photo.id}
                  lat={photo.lat}
                  lng={photo.lng}
                  photoUrl={photo.url}
                  onNavigate={onClose}
                />
              )}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-[var(--border)] pt-4 text-xs text-[var(--fg-muted)]">
            <div className="flex items-center gap-4">
              {!copyrightGuard && (
                <a
                  href={photo.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-[var(--fg)] hover:opacity-75 transition"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>{locale === "en" ? "Original" : "原图"}</span>
                </a>
              )}
              <button
                type="button"
                onClick={() => setShowPrintModal(true)}
                title={locale === "en" ? "Signature Frame (P)" : "签名框 (P)"}
                className="inline-flex items-center gap-1.5 text-sm text-[var(--fg)] hover:opacity-75 transition cursor-pointer"
              >
                <Download className="h-4 w-4" />
                <span>{locale === "en" ? "Print" : "签名框"}</span>
              </button>
              <button
                type="button"
                onClick={handleSharePhoto}
                className="inline-flex items-center gap-1.5 text-sm text-[var(--fg)] hover:opacity-75 transition cursor-pointer"
              >
                {copiedShare ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                <span>
                  {copiedShare
                    ? locale === "en"
                      ? "Copied"
                      : "已复制"
                    : locale === "en"
                    ? "Share"
                    : "分享"}
                </span>
              </button>
            </div>
            <ViewLink
              href={`/photo/${photo.id}`}
              onClick={onClose}
              className="hover:text-[var(--fg)] transition"
            >
              #{String(photo.id).padStart(2, "0")}
            </ViewLink>
          </div>
        </aside>
      </div>

      {showPrintModal && (
        <PrintCardModal
          photo={photo}
          swatches={hist?.swatches ?? []}
          photographerName={photographerName}
          photographerNameEn={photographerNameEn}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </div>
  );
}
