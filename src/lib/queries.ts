import { asc, desc, eq, inArray } from "drizzle-orm";
import { db, ensureDb } from "./db";
import { collectionPhotos, collections, gear, photos, siteSettings, type Collection, type GearItem, type Photo } from "./db/schema";
import { INITIAL_SETTINGS } from "./db/seed-data";

export interface CollectionWithPhotos extends Collection {
  photos: Photo[];
  photoCount: number;
}

export async function getAllPhotos(opts?: { includeHidden?: boolean }): Promise<Photo[]> {
  await ensureDb();
  const rows = await db.select().from(photos).orderBy(asc(photos.sortOrder), desc(photos.id));
  return opts?.includeHidden ? rows : rows.filter((p) => !p.hidden);
}

export async function getPhotoById(id: number, opts?: { includeHidden?: boolean }): Promise<Photo | null> {
  await ensureDb();
  const row = await db.select().from(photos).where(eq(photos.id, id)).get();
  if (!row || (!opts?.includeHidden && row.hidden)) return null;
  return row;
}

export async function getFeaturedPhotos(): Promise<Photo[]> {
  const all = await getAllPhotos();
  const featured = all.filter((p) => p.featured);
  return featured.length > 0 ? featured : all.slice(0, 8);
}

export async function getCollectionsWithPhotos(opts?: { includeHidden?: boolean }): Promise<CollectionWithPhotos[]> {
  await ensureDb();
  const cols = await db.select().from(collections).orderBy(asc(collections.sortOrder), desc(collections.id));
  const links = await db.select().from(collectionPhotos).orderBy(asc(collectionPhotos.sortOrder));
  const allPhotos = await getAllPhotos(opts);
  const photoMap = new Map(allPhotos.map((p) => [p.id, p]));

  return cols.map((col) => {
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
}

export async function getCollectionBySlug(slug: string): Promise<CollectionWithPhotos | null> {
  const all = await getCollectionsWithPhotos();
  return all.find((c) => c.slug === slug) ?? null;
}

export async function getPhotoCollectionsMap(): Promise<Record<number, { slug: string; title: string; titleEn: string }[]>> {
  await ensureDb();
  const cols = await db.select().from(collections);
  const links = await db.select().from(collectionPhotos);
  const colMap = new Map(cols.map((c) => [c.id, c]));
  const result: Record<number, { slug: string; title: string; titleEn: string }[]> = {};
  for (const link of links) {
    const col = colMap.get(link.collectionId);
    if (!col) continue;
    if (!result[link.photoId]) result[link.photoId] = [];
    result[link.photoId].push({ slug: col.slug, title: col.title, titleEn: col.titleEn });
  }
  return result;
}

export async function getAllGear(opts?: { includeHidden?: boolean }): Promise<(GearItem & { photoCount: number })[]> {
  await ensureDb();
  const items = await db.select().from(gear).orderBy(asc(gear.sortOrder), asc(gear.id));
  const allPhotos = await getAllPhotos(opts);
  return items.map((item) => {
    const count = allPhotos.filter((p) =>
      item.type === "camera" ? p.camera === item.name : p.lens === item.name
    ).length;
    return { ...item, photoCount: count };
  });
}

export async function getSiteSettings(): Promise<Record<string, string>> {
  await ensureDb();
  const rows = await db.select().from(siteSettings);
  const map: Record<string, string> = { ...INITIAL_SETTINGS };
  for (const r of rows) map[r.key] = r.value;
  return map;
}

export async function setCollectionPhotoIds(collectionId: number, photoIds: number[]) {
  await ensureDb();
  await db.delete(collectionPhotos).where(eq(collectionPhotos.collectionId, collectionId));
  if (photoIds.length === 0) return;
  const existing = await db.select({ id: photos.id }).from(photos).where(inArray(photos.id, photoIds));
  const valid = new Set(existing.map((e) => e.id));
  let idx = 1;
  for (const pid of photoIds) {
    if (valid.has(pid)) {
      await db.insert(collectionPhotos).values({ collectionId, photoId: pid, sortOrder: idx++ });
    }
  }
}
