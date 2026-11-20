"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Download, X } from "lucide-react";
import type { Photo } from "@/lib/db/schema";
import { usePreferences } from "./PreferencesProvider";

export type PrintTemplate = "classic" | "darkroom" | "editorial";

interface PrintCardModalProps {
  photo: Photo;
  swatches: string[];
  photographerName?: string;
  photographerNameEn?: string;
  onClose: () => void;
}

function getBrandAccent(camera: string): { color: string; shape: "circle" | "square" | "bar" } {
  const lower = camera.toLowerCase();
  if (lower.includes("leica")) return { color: "#E20613", shape: "circle" };
  if (lower.includes("hasselblad")) return { color: "#E07A16", shape: "square" };
  if (lower.includes("nikon") || /\bz\s?[56789f]\b/.test(lower)) return { color: "#EAB308", shape: "bar" };
  if (lower.includes("lumix") || lower.includes("panasonic") || lower.startsWith("dc-")) return { color: "#DC2626", shape: "bar" };
  if (lower.includes("canon") || lower.includes("eos")) return { color: "#DC2626", shape: "circle" };
  if (lower.includes("fuji") || /^x-|^gfx/i.test(lower)) return { color: "#059669", shape: "bar" };
  if (lower.includes("sony") || lower.startsWith("ilce")) return { color: "#EA580C", shape: "bar" };
  return { color: "#64748B", shape: "circle" };
}

function sampleImageSwatches(img: HTMLImageElement): string[] {
  try {
    const sample = document.createElement("canvas");
    sample.width = 72;
    sample.height = 72;
    const sctx = sample.getContext("2d", { willReadFrequently: true });
    if (!sctx) return [];
    sctx.drawImage(img, 0, 0, 72, 72);
    const data = sctx.getImageData(0, 0, 72, 72).data;

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
      if (chosen.every((c) => Math.hypot(c.r - cand.r, c.g - cand.g, c.b - cand.b) > 42)) {
        chosen.push(cand);
      }
      if (chosen.length === 5) break;
    }

    return chosen
      .sort((a, b) => 0.299 * a.r + 0.587 * a.g + 0.114 * a.b - (0.299 * b.r + 0.587 * b.g + 0.114 * b.b))
      .map(
        (c) =>
          `#${[c.r, c.g, c.b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("")}`
      );
  } catch {
    return [];
  }
}

export function PrintCardModal({
  photo,
  swatches,
  photographerName = "林远",
  photographerNameEn = "Lin Yuan",
  onClose,
}: PrintCardModalProps) {
  const { locale, pick } = usePreferences();
  const [template, setTemplate] = useState<PrintTemplate>("classic");
  const [showPalette, setShowPalette] = useState(true);
  const [autoSwatches, setAutoSwatches] = useState<string[]>([]);
  const [rendering, setRendering] = useState(true);
  const [downloaded, setDownloaded] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const activeSwatches = swatches.length > 0 ? swatches : autoSwatches;

  const title = pick(photo.title, photo.titleEn);
  const place = pick(photo.location, photo.locationEn);
  const author =
    photographerName && photographerNameEn && photographerName !== photographerNameEn
      ? `${photographerName} · ${photographerNameEn}`
      : photographerName;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setRendering(true);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = photo.url;
    img.onload = () => {
      if (cancelled || !canvasRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const palette =
        swatches.length > 0 ? swatches : autoSwatches.length > 0 ? autoSwatches : sampleImageSwatches(img);
      if (swatches.length === 0 && autoSwatches.length === 0 && palette.length > 0) {
        setAutoSwatches(palette);
      }

      const maxPhotoEdge = 1920;
      const scale = Math.min(1, maxPhotoEdge / Math.max(img.naturalWidth || 1600, img.naturalHeight || 1068));
      const pw = Math.round((img.naturalWidth || 1600) * scale);
      const ph = Math.round((img.naturalHeight || 1068) * scale);
      const base = Math.max(pw, ph);

      const isEditorial = template === "editorial";
      const isDark = template === "darkroom";

      const padSide = Math.round(base * (isEditorial ? 0.095 : 0.052));
      const padTop = Math.round(base * (isEditorial ? 0.095 : 0.052));
      const footerH = Math.round(base * (isEditorial ? 0.22 : 0.165));

      const cw = pw + padSide * 2;
      const ch = ph + padTop + footerH;
      canvas.width = cw;
      canvas.height = ch;

      // 1. Archival Paper / Darkroom Matte Background
      ctx.fillStyle = isDark ? "#0F1116" : isEditorial ? "#F7F8FA" : "#FAF9F5";
      ctx.fillRect(0, 0, cw, ch);

      // 2. Subtle Print Shadow + Photo + 1px Optical Rim
      ctx.save();
      ctx.shadowColor = isDark ? "rgba(0,0,0,0.65)" : "rgba(15,23,42,0.12)";
      ctx.shadowBlur = Math.round(base * 0.022);
      ctx.shadowOffsetY = Math.round(base * 0.006);
      ctx.drawImage(img, padSide, padTop, pw, ph);
      ctx.restore();

      ctx.strokeStyle = isDark ? "rgba(255,255,255,0.14)" : "rgba(15,23,42,0.08)";
      ctx.lineWidth = Math.max(1, Math.round(base * 0.001));
      ctx.strokeRect(padSide + 0.5, padTop + 0.5, pw - 1, ph - 1);

      const fontSans = `"Plus Jakarta Sans Variable", -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans SC", sans-serif`;
      const fgMain = isDark ? "#F4F5F7" : "#14171F";
      const fgSub = isDark ? "#8E96A4" : "#646C7A";
      const dividerCol = isDark ? "rgba(255,255,255,0.15)" : "rgba(15,23,42,0.13)";

      const exposureParts = [
        photo.focalMm ? `${photo.focalMm}mm` : "",
        photo.aperture || "",
        photo.shutter || "",
        photo.iso ? `ISO ${photo.iso}` : "",
      ].filter(Boolean);
      const exposureLine = exposureParts.join("  ");
      const metaLeft = [place, photo.takenAt, `© ${author}`].filter(Boolean).join("  ·  ");

      const footerTop = padTop + ph;
      const centerY = footerTop + footerH * 0.52;
      const titleSize = Math.max(20, Math.round(base * 0.021));
      const subSize = Math.max(14, Math.round(base * 0.014));

      if (isEditorial) {
        // Centered Gallery Monograph Typography
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.fillStyle = fgMain;
        ctx.font = `600 ${titleSize}px ${fontSans}`;
        ctx.fillText(title, cw / 2, footerTop + footerH * 0.34);

        const gearSpec = [photo.camera, photo.lens, exposureLine].filter(Boolean).join("   ·   ");
        ctx.fillStyle = fgSub;
        ctx.font = `400 ${subSize}px ${fontSans}`;
        ctx.fillText(gearSpec, cw / 2, footerTop + footerH * 0.54);

        if (showPalette && palette.length > 0) {
          const swW = Math.round(base * 0.024);
          const swH = Math.round(base * 0.0065);
          const gap = Math.round(base * 0.004);
          const totalW = palette.length * swW + (palette.length - 1) * gap;
          let sx = (cw - totalW) / 2;
          const sy = footerTop + footerH * 0.69;
          palette.forEach((hex) => {
            ctx.fillStyle = hex;
            ctx.fillRect(sx, sy, swW, swH);
            sx += swW + gap;
          });
        }

        ctx.fillStyle = fgSub;
        ctx.font = `400 ${Math.round(subSize * 0.88)}px ${fontSans}`;
        ctx.fillText([place, photo.takenAt, `© ${author}`].filter(Boolean).join("  ·  "), cw / 2, footerTop + footerH * 0.84);
      } else {
        // Classic White / Darkroom Split Leica-Hasselblad Signature Bar
        const leftX = padSide;
        const rightX = cw - padSide;

        // Left: Title + Location/Date/Author
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = fgMain;
        ctx.font = `600 ${titleSize}px ${fontSans}`;
        ctx.fillText(title, leftX, centerY - subSize * 0.35);

        ctx.fillStyle = fgSub;
        ctx.font = `400 ${subSize}px ${fontSans}`;
        ctx.fillText(metaLeft, leftX, centerY + subSize * 1.15);

        // Optional 5-color swatch bar aligned after or below left metadata
        if (showPalette && palette.length > 0) {
          const swW = Math.round(base * 0.022);
          const swH = Math.round(base * 0.0055);
          const gap = Math.round(base * 0.003);
          const sy = centerY + subSize * 1.75;
          palette.forEach((hex, idx) => {
            ctx.fillStyle = hex;
            ctx.fillRect(leftX + idx * (swW + gap), sy, swW, swH);
          });
        }

        // Right: Camera Model + Exposure/Lens + Brand Geometric Accent
        const camTitle = photo.camera || author;
        const rightSub = [exposureLine, photo.lens].filter(Boolean).join("  ·  ");

        ctx.textAlign = "right";
        ctx.fillStyle = fgMain;
        ctx.font = `600 ${Math.round(titleSize * 0.92)}px ${fontSans}`;
        const camW = ctx.measureText(camTitle).width;
        ctx.fillText(camTitle, rightX, centerY - subSize * 0.35);

        ctx.fillStyle = fgSub;
        ctx.font = `500 ${subSize}px ${fontSans}`;
        const subW = ctx.measureText(rightSub).width;
        ctx.fillText(rightSub, rightX, centerY + subSize * 1.15);

        // Vertical hairline divider + Brand Geometric Mark (crimson dot / precision square / bar)
        const blockW = Math.max(camW, subW);
        const divX = rightX - blockW - Math.round(base * 0.022);
        if (divX > cw * 0.46) {
          ctx.strokeStyle = dividerCol;
          ctx.lineWidth = Math.max(1, Math.round(base * 0.0012));
          ctx.beginPath();
          ctx.moveTo(divX, centerY - titleSize * 1.05);
          ctx.lineTo(divX, centerY + subSize * 1.35);
          ctx.stroke();

          if (photo.camera) {
            const brand = getBrandAccent(photo.camera);
            const markR = Math.max(6, Math.round(base * 0.0085));
            const mx = divX - Math.round(base * 0.022);
            const my = centerY + subSize * 0.12;
            ctx.fillStyle = brand.color;
            if (brand.shape === "circle") {
              ctx.beginPath();
              ctx.arc(mx, my, markR, 0, Math.PI * 2);
              ctx.fill();
            } else if (brand.shape === "square") {
              ctx.fillRect(mx - markR, my - markR, markR * 2, markR * 2);
            } else {
              ctx.fillRect(mx - Math.round(markR * 0.45), my - markR * 1.25, Math.round(markR * 0.9), markR * 2.5);
            }
          }
        }
      }

      setRendering(false);
    };

    return () => {
      cancelled = true;
    };
  }, [author, autoSwatches, photo, place, showPalette, swatches, template, title]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fine-art-${photo.id}-${template}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 1800);
    }, "image/png");
  };

  const templates: { id: PrintTemplate; zh: string; en: string }[] = [
    { id: "classic", zh: "白卡", en: "White" },
    { id: "darkroom", zh: "黑卡", en: "Dark" },
    { id: "editorial", zh: "画册", en: "Book" },
  ];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-4 sm:gap-5 bg-black/72 backdrop-blur-2xl px-3 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-8 animate-lightbox-in"
    >
      {/* Framed Print Canvas Directly on Stage */}
      <canvas
        ref={canvasRef}
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[68dvh] sm:max-h-[76dvh] max-w-[94vw] sm:max-w-[92vw] w-auto h-auto shadow-[0_28px_72px_rgba(0,0,0,0.65)] transition-opacity duration-200 ${
          rendering ? "opacity-40" : "opacity-100"
        }`}
      />

      {/* Minimal Single-Row Control Bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex flex-wrap items-center gap-2 rounded-lg border border-white/15 bg-zinc-900/75 px-3 py-1.5 text-xs text-zinc-200 backdrop-blur-xl"
      >
        <div className="flex items-center gap-1">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTemplate(t.id)}
              className={`rounded px-2.5 py-1 transition cursor-pointer ${
                template === t.id
                  ? "bg-white text-zinc-950 font-medium"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {locale === "en" ? t.en : t.zh}
            </button>
          ))}
        </div>

        {activeSwatches.length > 0 && (
          <>
            <span className="h-3.5 w-[1px] bg-white/15" />
            <button
              type="button"
              onClick={() => setShowPalette((v) => !v)}
              className={`rounded px-2.5 py-1 transition cursor-pointer ${
                showPalette ? "text-white font-medium" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {locale === "en" ? "Palette" : "色卡"}
            </button>
          </>
        )}

        <span className="h-3.5 w-[1px] bg-white/15" />

        <button
          type="button"
          onClick={handleDownload}
          disabled={rendering}
          className="inline-flex items-center gap-1.5 rounded bg-white px-3 py-1 font-medium text-zinc-950 hover:opacity-90 disabled:opacity-40 transition cursor-pointer"
        >
          {downloaded ? <Check className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
          <span>{downloaded ? (locale === "en" ? "Saved" : "已保存") : locale === "en" ? "Save" : "下载"}</span>
        </button>

        <button
          type="button"
          onClick={onClose}
          aria-label="关闭预览"
          className="rounded p-1 text-zinc-400 hover:text-white transition cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
