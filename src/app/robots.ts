import type { MetadataRoute } from "next";
import { getSiteSettings } from "@/lib/queries";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const settings = await getSiteSettings().catch(() => ({} as Record<string, string>));
  const base = (process.env.NEXT_PUBLIC_SITE_URL || settings.siteUrl || "http://localhost:3000").replace(/\/$/, "");

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/admin/"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
