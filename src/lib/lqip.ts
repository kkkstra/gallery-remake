import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

export async function generateBlurDataUrl(input: Buffer | string): Promise<string> {
  try {
    const buf = await sharp(input)
      .rotate()
      .resize(24, 24, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 46 })
      .toBuffer();
    return `data:image/webp;base64,${buf.toString("base64")}`;
  } catch {
    return "";
  }
}

export function resolveLocalPhotoPath(url: string): string | null {
  if (url.startsWith("/samples/")) {
    const p = path.join(process.cwd(), "public", url);
    return fs.existsSync(p) ? p : null;
  }
  if (url.startsWith("/uploads/")) {
    const name = path.basename(url);
    const p = path.join(process.cwd(), "data", "uploads", name);
    return fs.existsSync(p) ? p : null;
  }
  return null;
}
