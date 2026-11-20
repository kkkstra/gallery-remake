export const DEFAULT_FAVICON_DATA_URL =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect width="64" height="64" rx="15" fill="#111318"/>
      <rect x="2" y="2" width="60" height="60" rx="13" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="2"/>
      <circle cx="32" cy="32" r="16" fill="none" stroke="#f4f5f7" stroke-width="3.2"/>
      <circle cx="32" cy="32" r="7" fill="none" stroke="#a1a7b3" stroke-width="2.2"/>
      <circle cx="43" cy="21" r="2.4" fill="#f4f5f7"/>
    </svg>`
  );

export function buildAutoSiteTitle(settings: Record<string, string>): string {
  const zh = (settings.photographerName || "").trim() || "林远";
  const en = (settings.photographerNameEn || "").trim();
  if (en && en.toLowerCase() !== zh.toLowerCase()) {
    return `${zh} · 个人摄影作品集 | ${en} Photography`;
  }
  return `${zh} · 个人摄影作品集`;
}

export function resolveSiteTitle(settings: Record<string, string>): string {
  const custom = (settings.siteTitle || "").trim();
  return custom || buildAutoSiteTitle(settings);
}

export function resolveSiteDescription(settings: Record<string, string>): string {
  return (
    (settings.siteDescription || "").trim() ||
    (settings.tagline || "").trim() ||
    "记录自然尺幅、城市暮色与行旅瞬间。"
  );
}

export function resolveFaviconUrl(settings: Record<string, string>): string {
  return (settings.faviconUrl || "").trim() || DEFAULT_FAVICON_DATA_URL;
}
