import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { db, ensureDb } from "@/lib/db";
import { siteSettings } from "@/lib/db/schema";
import {
  parseOptionalIdList,
  resolveHomepageSections,
  serializeOptionalIdList,
} from "@/lib/homepage-config";
import {
  fetchSiteSettingsFresh,
  getAllPhotos,
  getCollectionsWithPhotos,
  invalidateGalleryCache,
} from "@/lib/queries";

export async function GET(req: Request) {
  if (!(await isAdminAuthenticated(req))) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  const [photos, collections, settings] = await Promise.all([
    getAllPhotos(),
    getCollectionsWithPhotos(),
    fetchSiteSettingsFresh(),
  ]);
  const resolved = resolveHomepageSections(photos, collections, settings);

  return NextResponse.json({
    config: {
      featuredIds: parseOptionalIdList(settings.homeFeaturedIds),
      collectionIds: parseOptionalIdList(settings.homeCollectionIds),
      galleryIds: parseOptionalIdList(settings.homeGalleryIds),
    },
    effective: {
      isCustomFeatured: resolved.isCustomFeatured,
      featuredIds: resolved.heroSlides.map((p) => p.id),
      isCustomCollections: resolved.isCustomCollections,
      collectionIds: resolved.curatedCollections.map((c) => c.id),
      isCustomGallery: resolved.isCustomGallery,
      galleryIds: resolved.galleryCards.map((c) => c.photo.id),
    },
  });
}

async function upsertHomepageConfig(req: Request) {
  if (!(await isAdminAuthenticated(req))) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  await ensureDb();
  const body = await req.json();

  const updates: [string, string][] = [];
  if ("featuredIds" in body) {
    updates.push([
      "homeFeaturedIds",
      Array.isArray(body.featuredIds) ? serializeOptionalIdList(body.featuredIds) : "",
    ]);
  }
  if ("collectionIds" in body) {
    updates.push([
      "homeCollectionIds",
      Array.isArray(body.collectionIds) ? serializeOptionalIdList(body.collectionIds) : "",
    ]);
  }
  if ("galleryIds" in body) {
    updates.push([
      "homeGalleryIds",
      Array.isArray(body.galleryIds) ? serializeOptionalIdList(body.galleryIds) : "",
    ]);
  }

  await Promise.all(
    updates.map(([key, value]) =>
      db
        .insert(siteSettings)
        .values({ key, value })
        .onConflictDoUpdate({ target: siteSettings.key, set: { value } })
    )
  );

  invalidateGalleryCache();
  return GET(req);
}

export const PUT = upsertHomepageConfig;
export const PATCH = upsertHomepageConfig;
