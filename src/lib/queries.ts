import { cache } from "react";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db, ensureDb } from "./db";
import {
  collectionPhotos,
  collections,
  gear,
  photos,
  siteSettings,
  type Collection,
  type GearItem,
  type Photo,
} from "./db/schema";
import { INITIAL_SETTINGS } from "./db/seed-data";
import { clusterGroupSiblings } from "./photo-groups";

export const GALLERY_CACHE_TAG = "gallery-data";

export function invalidateGalleryCache() {
  revalidateTag(GALLERY_CACHE_TAG, { expire: 0 });
  revalidatePath("/", "layout");
}

export interface CollectionWithPhotos extends Collection {
  photos: Photo[];
  photoCount: number;
}

async function fetchAllPhotosRaw(): Promise<Photo[]> {
  await ensureDb();
  const rows = await db
    .select()
    .from(photos)
    .orderBy(asc(photos.sortOrder), desc(photos.id));
  return clusterGroupSiblings(rows);
}

const getCachedPublicPhotos = cache(
  unstable_cache(
    async () => {
      const rows = await fetchAllPhotosRaw();
      return rows.filter((p) => !p.hidden);
    },
    ["public-photos-v4"],
    { tags: [GALLERY_CACHE_TAG], revalidate: 300 }
  )
);

export async function getAllPhotos(opts?: { includeHidden?: boolean }): Promise<Photo[]> {
  if (opts?.includeHidden) {
    return fetchAllPhotosRaw();
  }
  return getCachedPublicPhotos();
}

export async function getPhotoById(id: number, opts?: { includeHidden?: boolean }): Promise<Photo | null> {
  if (opts?.includeHidden) {
    await ensureDb();
    return (await db.select().from(photos).where(eq(photos.id, id)).get()) ?? null;
  }
  const all = await getCachedPublicPhotos();
  return all.find((p) => p.id === id) ?? null;
}

async function fetchCollectionsBundleRaw(includeHidden: boolean) {
  await ensureDb();
  const [cols, links, allPhotos] = await Promise.all([
    db.select().from(collections).orderBy(asc(collections.sortOrder), desc(collections.id)),
    db.select().from(collectionPhotos).orderBy(asc(collectionPhotos.sortOrder)),
    includeHidden ? fetchAllPhotosRaw() : getCachedPublicPhotos(),
  ]);

  const photoMap = new Map(allPhotos.map((p) => [p.id, p]));
  const colMap = new Map(cols.map((c) => [c.id, c]));

  const withPhotos: CollectionWithPhotos[] = cols.map((col) => {
    const colPhotos = links
      .filter((l) => l.collectionId === col.id)
      .map((l) => photoMap.get(l.photoId))
      .filter((p): p is Photo => Boolean(p));
    return {
      ...col,
      coverUrl: col.coverUrl || colPhotos[0]?.url || "",
      photos: colPhotos,
      photoCount: colPhotos.length,
    };
  });

  const byPhotoId: Record<number, { slug: string; title: string; titleEn: string }[]> = {};
  for (const link of links) {
    const col = colMap.get(link.collectionId);
    if (!col) continue;
    if (!byPhotoId[link.photoId]) byPhotoId[link.photoId] = [];
    byPhotoId[link.photoId].push({ slug: col.slug, title: col.title, titleEn: col.titleEn });
  }

  return { withPhotos, byPhotoId };
}

const getCachedPublicCollectionsBundle = cache(
  unstable_cache(
    async () => fetchCollectionsBundleRaw(false),
    ["public-collections-bundle-v4"],
    { tags: [GALLERY_CACHE_TAG], revalidate: 300 }
  )
);

export async function getCollectionsWithPhotos(opts?: { includeHidden?: boolean }): Promise<CollectionWithPhotos[]> {
  if (opts?.includeHidden) {
    return (await fetchCollectionsBundleRaw(true)).withPhotos;
  }
  return (await getCachedPublicCollectionsBundle()).withPhotos;
}

export async function getCollectionBySlug(slug: string): Promise<CollectionWithPhotos | null> {
  const all = await getCollectionsWithPhotos();
  return all.find((c) => c.slug === slug) ?? null;
}

export async function getPhotoCollectionsMap(): Promise<Record<number, { slug: string; title: string; titleEn: string }[]>> {
  return (await getCachedPublicCollectionsBundle()).byPhotoId;
}

async function fetchGearRaw(includeHidden: boolean): Promise<(GearItem & { photoCount: number })[]> {
  await ensureDb();
  const [items, allPhotos] = await Promise.all([
    db.select().from(gear).orderBy(asc(gear.sortOrder), asc(gear.id)),
    includeHidden ? fetchAllPhotosRaw() : getCachedPublicPhotos(),
  ]);
  return items.map((item) => {
    const count = allPhotos.filter((p) =>
      item.type === "camera" ? p.camera === item.name : p.lens === item.name
    ).length;
    return { ...item, photoCount: count };
  });
}

const getCachedPublicGear = cache(
  unstable_cache(async () => fetchGearRaw(false), ["public-gear"], {
    tags: [GALLERY_CACHE_TAG],
    revalidate: 300,
  })
);

export async function getAllGear(opts?: { includeHidden?: boolean }): Promise<(GearItem & { photoCount: number })[]> {
  if (opts?.includeHidden) return fetchGearRaw(true);
  return getCachedPublicGear();
}

export async function fetchSiteSettingsFresh(): Promise<Record<string, string>> {
  await ensureDb();
  const rows = await db.select().from(siteSettings);
  const map: Record<string, string> = { ...INITIAL_SETTINGS };
  for (const r of rows) {
    if (!r.key.startsWith("schema_v")) map[r.key] = r.value;
  }
  return map;
}

export const getSiteSettings = cache(
  unstable_cache(fetchSiteSettingsFresh, ["public-site-settings"], {
    tags: [GALLERY_CACHE_TAG],
    revalidate: 300,
  })
);

export async function setCollectionPhotoIds(collectionId: number, photoIds: number[]) {
  await ensureDb();
  await db.delete(collectionPhotos).where(eq(collectionPhotos.collectionId, collectionId));
  if (photoIds.length === 0) return;
  const existing = await db.select({ id: photos.id }).from(photos).where(inArray(photos.id, photoIds));
  const valid = new Set(existing.map((e) => e.id));
  const values = photoIds
    .filter((pid) => valid.has(pid))
    .map((pid, i) => ({ collectionId, photoId: pid, sortOrder: i + 1 }));
  if (values.length > 0) {
    await db.insert(collectionPhotos).values(values);
  }
}
