import type { MetadataRoute } from "next";
import { getAllPhotos, getCollectionsWithPhotos, getSiteSettings } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [photos, collections, settings] = await Promise.all([
    getAllPhotos(),
    getCollectionsWithPhotos(),
    getSiteSettings(),
  ]);

  const base = (process.env.NEXT_PUBLIC_SITE_URL || settings.siteUrl || "http://localhost:3000").replace(/\/$/, "");
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/gallery`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/collections`, lastModified: now, changeFrequency: "weekly", priority: 0.85 },
    { url: `${base}/map`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
  ];

  const colRoutes: MetadataRoute.Sitemap = collections.map((c) => ({
    url: `${base}/collections/${c.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  const photoRoutes: MetadataRoute.Sitemap = photos.map((p) => ({
    url: `${base}/photo/${p.id}`,
    lastModified: p.createdAt ? new Date(p.createdAt) : now,
    changeFrequency: "yearly",
    priority: 0.65,
  }));

  return [...staticRoutes, ...colRoutes, ...photoRoutes];
}
