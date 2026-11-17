import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import * as schema from "./schema";
import { INITIAL_COLLECTIONS, INITIAL_GEAR, INITIAL_PHOTOS, INITIAL_SETTINGS } from "./seed-data";

const dataDir = path.join(process.cwd(), "data");
if (!process.env.DATABASE_URL && !fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const client = createClient({
  url: process.env.DATABASE_URL || `file:${path.join(dataDir, "gallery.db")}`,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });

let initPromise: Promise<void> | null = null;

export function ensureDb(): Promise<void> {
  if (!initPromise) {
    initPromise = bootstrapDb().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

async function bootstrapDb() {
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      title_en TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      description_en TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL,
      width INTEGER NOT NULL DEFAULT 1600,
      height INTEGER NOT NULL DEFAULT 1068,
      ambient TEXT NOT NULL DEFAULT '#1e2024',
      category TEXT NOT NULL DEFAULT 'landscape',
      featured INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      taken_at TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      location_en TEXT NOT NULL DEFAULT '',
      lat REAL,
      lng REAL,
      camera TEXT NOT NULL DEFAULT '',
      lens TEXT NOT NULL DEFAULT '',
      focal_mm INTEGER,
      aperture TEXT NOT NULL DEFAULT '',
      shutter TEXT NOT NULL DEFAULT '',
      iso INTEGER,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      title_en TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      description_en TEXT NOT NULL DEFAULT '',
      cover_url TEXT NOT NULL DEFAULT '',
      period TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS collection_photos (
      collection_id INTEGER NOT NULL,
      photo_id INTEGER NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (collection_id, photo_id)
    );

    CREATE TABLE IF NOT EXISTS gear (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL DEFAULT 'camera',
      brand TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      specs TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      note_en TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const initialized = await db
    .select()
    .from(schema.siteSettings)
    .where(eq(schema.siteSettings.key, "initialized"))
    .get();

  if (initialized) return;

  const now = new Date().toISOString();
  for (const [key, value] of Object.entries(INITIAL_SETTINGS)) {
    await db.insert(schema.siteSettings).values({ key, value }).onConflictDoNothing();
  }

  const insertedPhotos: { id: number; title: string }[] = [];
  for (const p of INITIAL_PHOTOS) {
    const res = await db
      .insert(schema.photos)
      .values({ ...p, createdAt: now })
      .returning({ id: schema.photos.id, title: schema.photos.title });
    if (res[0]) insertedPhotos.push(res[0]);
  }

  for (const col of INITIAL_COLLECTIONS) {
    const { photoTitles, ...colFields } = col;
    const inserted = await db
      .insert(schema.collections)
      .values(colFields)
      .returning({ id: schema.collections.id });
    const colId = inserted[0]?.id;
    if (colId) {
      for (let i = 0; i < photoTitles.length; i++) {
        const match = insertedPhotos.find((p) => p.title === photoTitles[i]);
        if (match) {
          await db
            .insert(schema.collectionPhotos)
            .values({ collectionId: colId, photoId: match.id, sortOrder: i + 1 })
            .onConflictDoNothing();
        }
      }
    }
  }

  for (const g of INITIAL_GEAR) {
    await db.insert(schema.gear).values(g);
  }
}
