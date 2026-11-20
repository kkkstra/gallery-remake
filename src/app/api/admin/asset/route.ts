import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { isAdminAuthenticated } from "@/lib/auth";
import { db, ensureDb } from "@/lib/db";
import { siteSettings } from "@/lib/db/schema";
import { resolveLocalPhotoPath } from "@/lib/lqip";
import { invalidateGalleryCache } from "@/lib/queries";
import { storeUploadedFile } from "@/lib/storage";

function buildMaskSvg(size: number, shape: "rounded" | "circle" | "square"): Buffer | null {
  if (shape === "square") return null;
  if (shape === "circle") {
    const r = size / 2;
    return Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${r}" cy="${r}" r="${r}" fill="#fff"/></svg>`
    );
  }
  const rx = Math.round(size * 0.22);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${rx}" ry="${rx}" fill="#fff"/></svg>`
  );
}

async function resolveInputBuffer(
  req: Request
): Promise<{
  buffer: Buffer;
  filename: string;
  mimeType: string;
  target: "raw" | "favicon" | "avatar";
  shape: "rounded" | "circle" | "square";
  rotate: number;
  apply: boolean;
  crop?: { left: number; top: number; width: number; height: number };
} | null> {
  const ctype = req.headers.get("content-type") || "";
  if (ctype.includes("application/json")) {
    const body = await req.json();
    const src = String(body.sourceUrl || "").trim();
    if (!src) return null;
    let buffer: Buffer;
    const localPath = resolveLocalPhotoPath(src);
    if (localPath) {
      buffer = await fs.readFile(localPath);
    } else {
      const res = await fetch(src.startsWith("http") ? src : new URL(src, req.url));
      if (!res.ok) throw new Error("无法读取源图片地址");
      buffer = Buffer.from(await res.arrayBuffer());
    }
    const target = body.target === "favicon" || body.target === "avatar" ? body.target : "raw";
    const shape =
      body.shape === "circle" || body.shape === "square" || body.shape === "rounded"
        ? body.shape
        : target === "favicon"
        ? "rounded"
        : "square";
    const crop =
      body.crop &&
      Number.isFinite(Number(body.crop.width)) &&
      Number.isFinite(Number(body.crop.height)) &&
      Number(body.crop.width) > 0 &&
      Number(body.crop.height) > 0
        ? {
            left: Math.max(0, Math.round(Number(body.crop.left || 0))),
            top: Math.max(0, Math.round(Number(body.crop.top || 0))),
            width: Math.round(Number(body.crop.width)),
            height: Math.round(Number(body.crop.height)),
          }
        : undefined;
    return {
      buffer,
      filename: `${target}-asset`,
      mimeType: "image/png",
      target,
      shape,
      rotate: Number(body.rotate || 0),
      apply: Boolean(body.apply),
      crop,
    };
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return null;
  const rawTarget = String(form.get("target") || "raw");
  const target = rawTarget === "favicon" || rawTarget === "avatar" ? rawTarget : "raw";
  const rawShape = String(form.get("shape") || "");
  const shape =
    rawShape === "circle" || rawShape === "square" || rawShape === "rounded"
      ? rawShape
      : target === "favicon"
      ? "rounded"
      : "square";
  const cw = Number(form.get("cropWidth") || 0);
  const ch = Number(form.get("cropHeight") || 0);
  const crop =
    cw > 0 && ch > 0
      ? {
          left: Math.max(0, Math.round(Number(form.get("cropLeft") || 0))),
          top: Math.max(0, Math.round(Number(form.get("cropTop") || 0))),
          width: Math.round(cw),
          height: Math.round(ch),
        }
      : undefined;

  return {
    buffer: Buffer.from(await file.arrayBuffer()),
    filename: file.name || "brand-asset.png",
    mimeType: file.type || "image/png",
    target,
    shape,
    rotate: Number(form.get("rotate") || 0),
    apply: form.get("apply") === "true",
    crop,
  };
}

export async function POST(req: Request) {
  if (!(await isAdminAuthenticated(req))) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  let parsed: Awaited<ReturnType<typeof resolveInputBuffer>>;
  try {
    parsed = await resolveInputBuffer(req);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "读取图片失败" },
      { status: 400 }
    );
  }
  if (!parsed) {
    return NextResponse.json({ error: "缺少图片文件或 sourceUrl" }, { status: 400 });
  }

  let outBuffer = parsed.buffer;
  let outName = parsed.filename;
  let outMime = parsed.mimeType;

  // Server-side crop / resize / mask when target is "favicon" or "avatar", or when transform params are passed
  if (parsed.target !== "raw" || parsed.crop || parsed.rotate) {
    const outSize = parsed.target === "favicon" ? 256 : 512;
    let pipeline = sharp(parsed.buffer).rotate(parsed.rotate || undefined);
    if (parsed.crop) {
      pipeline = pipeline.extract(parsed.crop);
    }
    pipeline = pipeline.resize(outSize, outSize, { fit: "cover", position: "centre" });

    if (parsed.target === "favicon" || parsed.shape !== "square") {
      const mask = buildMaskSvg(outSize, parsed.shape);
      if (mask) {
        const resizedPng = await pipeline.ensureAlpha().png().toBuffer();
        outBuffer = await sharp(resizedPng)
          .composite([{ input: mask, blend: "dest-in" }])
          .png()
          .toBuffer();
      } else {
        outBuffer = await pipeline.png().toBuffer();
      }
      outName = "favicon.png";
      outMime = "image/png";
    } else {
      outBuffer = await pipeline.webp({ quality: 92 }).toBuffer();
      outName = "avatar.webp";
      outMime = "image/webp";
    }
  }

  const url = await storeUploadedFile(outBuffer, outName, outMime);

  let appliedTo: string | null = null;
  if (parsed.apply && (parsed.target === "favicon" || parsed.target === "avatar")) {
    await ensureDb();
    appliedTo = parsed.target === "favicon" ? "faviconUrl" : "avatarUrl";
    await db
      .insert(siteSettings)
      .values({ key: appliedTo, value: url })
      .onConflictDoUpdate({ target: siteSettings.key, set: { value: url } });
    invalidateGalleryCache();
  }

  return NextResponse.json({ url, ...(appliedTo ? { appliedTo } : {}) });
}
