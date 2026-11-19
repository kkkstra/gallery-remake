import { getAllPhotos, getSiteSettings } from "@/lib/queries";

function escXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(req: Request) {
  const [photos, settings] = await Promise.all([getAllPhotos(), getSiteSettings()]);
  const reqOrigin = new URL(req.url).origin;
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || settings.siteUrl || reqOrigin).replace(/\/$/, "");
  const author = settings.photographerName || "林远";
  const siteTitle = `${author} · 摄影作品集`;
  const siteDesc = settings.tagline || "记录自然尺幅、城市暮色与行旅瞬间";

  const sorted = [...photos].sort(
    (a, b) => (b.takenAt || b.createdAt).localeCompare(a.takenAt || a.createdAt) || b.id - a.id
  );

  const itemsXml = sorted
    .slice(0, 40)
    .map((p) => {
      const link = `${baseUrl}/photo/${p.id}`;
      const imgUrl = p.url.startsWith("http") ? p.url : `${baseUrl}${p.url}`;
      const specs = [p.camera, p.lens, p.focalMm ? `${p.focalMm}mm` : "", p.aperture, p.shutter]
        .filter(Boolean)
        .join(" · ");
      const summary = [p.description, p.location, specs].filter(Boolean).join(" | ");
      const pubDate = p.takenAt ? new Date(`${p.takenAt}T08:00:00Z`).toUTCString() : new Date(p.createdAt).toUTCString();

      return `    <item>
      <title>${escXml(p.title)}</title>
      <link>${escXml(link)}</link>
      <guid isPermaLink="true">${escXml(link)}</guid>
      <pubDate>${escXml(pubDate)}</pubDate>
      <description>${escXml(summary)}</description>
      <enclosure url="${escXml(imgUrl)}" type="image/jpeg" length="0" />
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escXml(siteTitle)}</title>
    <link>${escXml(baseUrl)}</link>
    <description>${escXml(siteDesc)}</description>
    <language>zh-cn</language>
    <atom:link href="${escXml(`${baseUrl}/feed.xml`)}" rel="self" type="application/rss+xml" />
${itemsXml}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=1800",
    },
  });
}
