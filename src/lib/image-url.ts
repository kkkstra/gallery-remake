export type ImgWidth = 64 | 96 | 128 | 256 | 384 | 640 | 828 | 1080 | 1200 | 1920 | 2048 | 3840;
export type ImgQuality = 75 | 85;

function canOptimize(url: string): boolean {
  if (!url || url.startsWith("data:") || url.startsWith("blob:") || url.startsWith("/_next/image")) {
    return false;
  }
  const clean = url.split("?")[0].toLowerCase();
  if (clean.endsWith(".svg") || clean.endsWith(".gif")) return false;
  return url.startsWith("/") || url.startsWith("https://") || url.startsWith("http://");
}

export function optImg(url: string, width: ImgWidth, quality: ImgQuality = 75): string {
  if (!canOptimize(url)) return url;
  return `/_next/image?url=${encodeURIComponent(url)}&w=${width}&q=${quality}`;
}

export function optSrcSet(
  url: string,
  widths: readonly ImgWidth[],
  quality: ImgQuality = 85
): string | undefined {
  if (!canOptimize(url)) return undefined;
  return widths.map((w) => `${optImg(url, w, quality)} ${w}w`).join(", ");
}
