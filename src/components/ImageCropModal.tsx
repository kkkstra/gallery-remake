"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, RotateCw, RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react";
import { optImg } from "@/lib/image-url";

export type CropMaskShape = "rounded" | "circle" | "square";

interface ImageCropModalProps {
  imageSrc: string;
  mode: "avatar" | "favicon";
  previewTitle?: string;
  onCancel: () => void;
  onApply: (blob: Blob, filename: string) => Promise<void>;
}

const VIEW_SIZE = 272;

function drawRoundedRectPath(ctx: CanvasRenderingContext2D, size: number, radiusRatio: number) {
  const r = size * radiusRatio;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.quadraticCurveTo(size, 0, size, r);
  ctx.lineTo(size, size - r);
  ctx.quadraticCurveTo(size, size, size - r, size);
  ctx.lineTo(r, size);
  ctx.quadraticCurveTo(0, size, 0, size - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
}

export function ImageCropModal({
  imageSrc,
  mode,
  previewTitle = "摄影作品集",
  onCancel,
  onApply,
}: ImageCropModalProps) {
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0); // 0 | 90 | 180 | 270
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [shape, setShape] = useState<CropMaskShape>(mode === "favicon" ? "rounded" : "circle");
  const [submitting, setSubmitting] = useState(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string>("");

  const stageCanvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(
    null
  );

  // Load source image (use same-origin optimized proxy if remote URL so canvas is never CORS-tainted)
  useEffect(() => {
    let cancelled = false;
    setLoadError(false);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      setImgEl(img);
      setZoom(1);
      setRotation(0);
      setOffset({ x: 0, y: 0 });
    };
    img.onerror = () => {
      if (!cancelled) setLoadError(true);
    };
    img.src = imageSrc.startsWith("http") ? optImg(imageSrc, 1080, 85) : imageSrc;
    return () => {
      cancelled = true;
    };
  }, [imageSrc]);

  const getBounds = useCallback(
    (z: number, rot: number) => {
      if (!imgEl) return { drawW: VIEW_SIZE, drawH: VIEW_SIZE, maxX: 0, maxY: 0 };
      const swapped = rot % 180 !== 0;
      const nw = swapped ? imgEl.naturalHeight : imgEl.naturalWidth;
      const nh = swapped ? imgEl.naturalWidth : imgEl.naturalHeight;
      const baseScale = Math.max(VIEW_SIZE / Math.max(1, nw), VIEW_SIZE / Math.max(1, nh));
      const drawW = nw * baseScale * z;
      const drawH = nh * baseScale * z;
      return {
        drawW,
        drawH,
        maxX: Math.max(0, (drawW - VIEW_SIZE) / 2),
        maxY: Math.max(0, (drawH - VIEW_SIZE) / 2),
      };
    },
    [imgEl]
  );

  const clampOffset = useCallback(
    (next: { x: number; y: number }, z = zoom, rot = rotation) => {
      const { maxX, maxY } = getBounds(z, rot);
      return {
        x: Math.max(-maxX, Math.min(maxX, next.x)),
        y: Math.max(-maxY, Math.min(maxY, next.y)),
      };
    },
    [getBounds, rotation, zoom]
  );

  const renderCroppedCanvas = useCallback(
    (targetSize: number, applyMask: boolean): HTMLCanvasElement | null => {
      if (!imgEl) return null;
      const out = document.createElement("canvas");
      out.width = targetSize;
      out.height = targetSize;
      const ctx = out.getContext("2d");
      if (!ctx) return null;

      const ratio = targetSize / VIEW_SIZE;
      ctx.clearRect(0, 0, targetSize, targetSize);

      ctx.save();
      if (applyMask) {
        if (shape === "circle") {
          ctx.beginPath();
          ctx.arc(targetSize / 2, targetSize / 2, targetSize / 2, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
        } else if (shape === "rounded") {
          drawRoundedRectPath(ctx, targetSize, 0.22);
          ctx.clip();
        }
      }

      const swapped = rotation % 180 !== 0;
      const nw = swapped ? imgEl.naturalHeight : imgEl.naturalWidth;
      const nh = swapped ? imgEl.naturalWidth : imgEl.naturalHeight;
      const baseScale = Math.max(targetSize / Math.max(1, nw), targetSize / Math.max(1, nh));
      const scale = baseScale * zoom;

      ctx.translate(targetSize / 2 + offset.x * ratio, targetSize / 2 + offset.y * ratio);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(
        imgEl,
        (-imgEl.naturalWidth * scale) / 2,
        (-imgEl.naturalHeight * scale) / 2,
        imgEl.naturalWidth * scale,
        imgEl.naturalHeight * scale
      );
      ctx.restore();
      return out;
    },
    [imgEl, offset.x, offset.y, rotation, shape, zoom]
  );

  // Paint interactive stage + live small preview
  useEffect(() => {
    const stage = stageCanvasRef.current;
    if (!stage || !imgEl) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    stage.width = VIEW_SIZE * dpr;
    stage.height = VIEW_SIZE * dpr;
    const ctx = stage.getContext("2d");
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#0b0d12";
    ctx.fillRect(0, 0, VIEW_SIZE, VIEW_SIZE);

    const swapped = rotation % 180 !== 0;
    const nw = swapped ? imgEl.naturalHeight : imgEl.naturalWidth;
    const nh = swapped ? imgEl.naturalWidth : imgEl.naturalHeight;
    const baseScale = Math.max(VIEW_SIZE / Math.max(1, nw), VIEW_SIZE / Math.max(1, nh));
    const scale = baseScale * zoom;

    ctx.save();
    ctx.translate(VIEW_SIZE / 2 + offset.x, VIEW_SIZE / 2 + offset.y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(
      imgEl,
      (-imgEl.naturalWidth * scale) / 2,
      (-imgEl.naturalHeight * scale) / 2,
      imgEl.naturalWidth * scale,
      imgEl.naturalHeight * scale
    );
    ctx.restore();

    // Dim outside mask area so user sees exact final crop silhouette
    if (shape !== "square") {
      ctx.save();
      ctx.fillStyle = "rgba(0, 0, 0, 0.52)";
      ctx.beginPath();
      ctx.rect(0, 0, VIEW_SIZE, VIEW_SIZE);
      if (shape === "circle") {
        ctx.arc(VIEW_SIZE / 2, VIEW_SIZE / 2, VIEW_SIZE / 2 - 1, 0, Math.PI * 2, true);
      } else {
        const r = VIEW_SIZE * 0.22;
        ctx.moveTo(r, 0);
        ctx.quadraticCurveTo(0, 0, 0, r);
        ctx.lineTo(0, VIEW_SIZE - r);
        ctx.quadraticCurveTo(0, VIEW_SIZE, r, VIEW_SIZE);
        ctx.lineTo(VIEW_SIZE - r, VIEW_SIZE);
        ctx.quadraticCurveTo(VIEW_SIZE, VIEW_SIZE, VIEW_SIZE, VIEW_SIZE - r);
        ctx.lineTo(VIEW_SIZE, r);
        ctx.quadraticCurveTo(VIEW_SIZE, 0, VIEW_SIZE - r, 0);
        ctx.closePath();
      }
      ctx.fill("evenodd");
      ctx.restore();
    }

    // Subtle rule-of-thirds optical grid
    ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
    ctx.lineWidth = 1;
    for (const frac of [1 / 3, 2 / 3]) {
      const pos = Math.round(VIEW_SIZE * frac) + 0.5;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, VIEW_SIZE);
      ctx.moveTo(0, pos);
      ctx.lineTo(VIEW_SIZE, pos);
      ctx.stroke();
    }
    ctx.restore();

    const mini = renderCroppedCanvas(128, mode === "favicon");
    if (mini) setPreviewDataUrl(mini.toDataURL("image/png"));
  }, [imgEl, mode, offset.x, offset.y, renderCroppedCanvas, rotation, shape, zoom]);

  const updateZoom = (nextZoom: number) => {
    const z = Math.max(1, Math.min(4, Number(nextZoom.toFixed(2))));
    setZoom(z);
    setOffset((prev) => clampOffset(prev, z, rotation));
  };

  const rotate90 = () => {
    const nextRot = (rotation + 90) % 360;
    setRotation(nextRot);
    setOffset((prev) => clampOffset(prev, zoom, nextRot));
  };

  const handleConfirm = async () => {
    const outSize = mode === "favicon" ? 256 : 512;
    const applyMask = mode === "favicon" && shape !== "square";
    const out = renderCroppedCanvas(outSize, applyMask);
    if (!out) return;

    setSubmitting(true);
    try {
      const mime = mode === "favicon" ? "image/png" : "image/webp";
      const ext = mode === "favicon" ? "png" : "webp";
      const blob = await new Promise<Blob | null>((resolve) =>
        out.toBlob((b) => resolve(b), mime, 0.92)
      );
      if (!blob) return;
      await onApply(blob, `${mode}-${Date.now()}.${ext}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={onCancel}
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-lightbox-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="surface-card w-full max-w-md rounded-2xl p-5 space-y-4 text-xs text-[var(--fg)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <div>
            <h3 className="text-sm font-semibold">
              {mode === "favicon" ? "裁剪并设置网站图标 (Favicon)" : "裁剪并设置摄影师头像"}
            </h3>
            <p className="text-[11px] text-[var(--fg-muted)]">
              拖拽画面调整构图，滚轮或滑块缩放，点击确认后立即上传生效
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full p-1 text-[var(--fg-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg)] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Interactive 1:1 Crop Stage */}
        <div className="flex flex-col items-center gap-3">
          {loadError ? (
            <div className="flex h-[272px] w-[272px] items-center justify-center rounded-xl border border-[var(--border)] text-[var(--fg-muted)]">
              图片读取失败，请重新选择本地图片
            </div>
          ) : (
            <div
              onWheel={(e) => {
                e.preventDefault();
                updateZoom(zoom - e.deltaY * 0.0022);
              }}
              className="relative overflow-hidden rounded-xl ring-1 ring-[var(--border)] select-none touch-none"
              style={{ width: VIEW_SIZE, height: VIEW_SIZE }}
            >
              <canvas
                ref={stageCanvasRef}
                style={{ width: VIEW_SIZE, height: VIEW_SIZE }}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  dragRef.current = {
                    startX: e.clientX,
                    startY: e.clientY,
                    origX: offset.x,
                    origY: offset.y,
                  };
                }}
                onPointerMove={(e) => {
                  if (!dragRef.current) return;
                  const dx = e.clientX - dragRef.current.startX;
                  const dy = e.clientY - dragRef.current.startY;
                  setOffset(
                    clampOffset({
                      x: dragRef.current.origX + dx,
                      y: dragRef.current.origY + dy,
                    })
                  );
                }}
                onPointerUp={() => {
                  dragRef.current = null;
                }}
                onPointerCancel={() => {
                  dragRef.current = null;
                }}
                className="block cursor-grab active:cursor-grabbing"
              />
            </div>
          )}

          {/* Zoom + Rotate + Shape Controls */}
          <div className="w-full space-y-2.5">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => updateZoom(zoom - 0.2)}
                className="rounded border border-[var(--border)] p-1.5 text-[var(--fg-muted)] hover:text-[var(--fg)] cursor-pointer"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <input
                type="range"
                min={1}
                max={4}
                step={0.02}
                value={zoom}
                onChange={(e) => updateZoom(Number(e.target.value))}
                className="flex-1 accent-emerald-500 cursor-pointer"
              />
              <button
                type="button"
                onClick={() => updateZoom(zoom + 0.2)}
                className="rounded border border-[var(--border)] p-1.5 text-[var(--fg-muted)] hover:text-[var(--fg)] cursor-pointer"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
              <span className="w-10 text-right font-mono text-[11px] text-[var(--fg-muted)]">
                {zoom.toFixed(1)}×
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              {mode === "favicon" ? (
                <div className="inline-flex rounded-md border border-[var(--border)] bg-[var(--bg-subtle)] p-0.5">
                  {(
                    [
                      ["rounded", "圆角图标"],
                      ["circle", "圆形图标"],
                      ["square", "方形满幅"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setShape(id)}
                      className={`rounded px-2.5 py-1 transition cursor-pointer ${
                        shape === id
                          ? "bg-[var(--fg)] text-[var(--bg)] font-medium"
                          : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="text-[11px] text-[var(--fg-muted)]">输出尺寸：512 × 512 高清方形头像</span>
              )}

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={rotate90}
                  className="inline-flex items-center gap-1 rounded border border-[var(--border)] px-2.5 py-1 text-[var(--fg-muted)] hover:text-[var(--fg)] cursor-pointer"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  <span>旋转 90°</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1);
                    setRotation(0);
                    setOffset({ x: 0, y: 0 });
                  }}
                  className="inline-flex items-center gap-1 rounded border border-[var(--border)] px-2 py-1 text-[var(--fg-muted)] hover:text-[var(--fg)] cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>重置</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Live Real-World Preview Bar */}
        {previewDataUrl && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)]/65 p-3">
            {mode === "favicon" ? (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] text-[var(--fg-subtle)] mb-1">浏览器标签页实时预览</div>
                  <div className="inline-flex max-w-full items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 shadow-xs">
                    <img src={previewDataUrl} alt="" className="h-4 w-4 shrink-0 object-contain" />
                    <span className="truncate text-xs font-medium text-[var(--fg)]">
                      {previewTitle}
                    </span>
                  </div>
                </div>
                <img
                  src={previewDataUrl}
                  alt=""
                  className="h-11 w-11 shrink-0 object-contain"
                  title="桌面 / 手机主屏幕图标预览"
                />
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <img
                  src={previewDataUrl}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-[var(--border)]"
                />
                <div className="min-w-0">
                  <div className="font-medium text-[var(--fg)]">关于页与工作台头像预览</div>
                  <div className="text-[11px] text-[var(--fg-muted)]">
                    支持拖拽微调人物或标志居中位置
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-[var(--border)] px-4 py-2 text-[var(--fg-muted)] hover:text-[var(--fg)] cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            disabled={!imgEl || submitting}
            onClick={handleConfirm}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500 px-4 py-2 font-medium text-white hover:bg-emerald-600 disabled:opacity-45 transition cursor-pointer"
          >
            <Check className="h-3.5 w-3.5" />
            <span>{submitting ? "正在上传并设置…" : "裁剪并直接设置"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
