import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import * as schema from "./schema";
import { INITIAL_COLLECTIONS, INITIAL_GEAR, INITIAL_PHOTOS, INITIAL_SETTINGS } from "./seed-data";
import { generateBlurDataUrl, resolveLocalPhotoPath } from "../lqip";

const dataDir = process.env.VERCEL
  ? path.join("/tmp", "gallery-data")
  : path.join(process.cwd(), "data");
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
  try {
    const marker = await client.execute(
      "SELECT value FROM site_settings WHERE key = 'schema_v4' LIMIT 1"
    );
    if (marker.rows.length > 0) return;
  } catch {
    // Fresh database — proceed with full bootstrap
  }

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
      blur_data TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'landscape',
      featured INTEGER NOT NULL DEFAULT 0,
      hidden INTEGER NOT NULL DEFAULT 0,
      group_id TEXT NOT NULL DEFAULT '',
      group_order INTEGER NOT NULL DEFAULT 0,
      group_expanded INTEGER NOT NULL DEFAULT 0,
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
      blocks_json TEXT NOT NULL DEFAULT '',
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

  // Safe idempotent migration for existing databases
  try {
    await client.execute("ALTER TABLE photos ADD COLUMN blur_data TEXT NOT NULL DEFAULT ''");
  } catch {
    // Column already exists
  }
  try {
    await client.execute("ALTER TABLE collections ADD COLUMN blocks_json TEXT NOT NULL DEFAULT ''");
  } catch {
    // Column already exists
  }
  try {
    await client.execute("ALTER TABLE photos ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0");
  } catch {
    // Column already exists
  }
  try {
    await client.execute("ALTER TABLE photos ADD COLUMN group_id TEXT NOT NULL DEFAULT ''");
  } catch {
    // Column already exists
  }
  try {
    await client.execute("ALTER TABLE photos ADD COLUMN group_order INTEGER NOT NULL DEFAULT 0");
  } catch {
    // Column already exists
  }
  try {
    await client.execute("ALTER TABLE photos ADD COLUMN group_expanded INTEGER NOT NULL DEFAULT 0");
  } catch {
    // Column already exists
  }

  const initialized = await db
    .select()
    .from(schema.siteSettings)
    .where(eq(schema.siteSettings.key, "initialized"))
    .get();

  if (!initialized) {
    const now = new Date().toISOString();
    for (const [key, value] of Object.entries(INITIAL_SETTINGS)) {
      await db.insert(schema.siteSettings).values({ key, value }).onConflictDoNothing();
    }

    const insertedPhotos: { id: number; title: string }[] = [];
    for (const p of INITIAL_PHOTOS) {
      const localFile = resolveLocalPhotoPath(p.url);
      const blurData = localFile ? await generateBlurDataUrl(localFile) : "";
      const res = await db
        .insert(schema.photos)
        .values({ ...p, blurData, createdAt: now })
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
    await db
      .insert(schema.siteSettings)
      .values({ key: "schema_v4", value: "1" })
      .onConflictDoUpdate({ target: schema.siteSettings.key, set: { value: "1" } });
    return;
  }

  // Backfill missing 24px LQIP blurData for existing local photos once
  const missingBlur = await db
    .select({ id: schema.photos.id, url: schema.photos.url, blurData: schema.photos.blurData })
    .from(schema.photos);
  for (const row of missingBlur) {
    if (!row.blurData) {
      const localFile = resolveLocalPhotoPath(row.url);
      if (localFile) {
        const blurData = await generateBlurDataUrl(localFile);
        if (blurData) {
          await db.update(schema.photos).set({ blurData }).where(eq(schema.photos.id, row.id));
        }
      }
    }
  }

  // Seed or upgrade default Book Cover + Chapter I + Chapter II + side-note blocks on sample collections
  const existingCols = await db.select().from(schema.collections);
  const existingLinks = await db.select().from(schema.collectionPhotos);
  const allPhotoRows = await db.select().from(schema.photos);
  const pMap = new Map(allPhotoRows.map((p) => [p.id, p]));

  const chapterMeta: Record<
    string,
    {
      ch1Title: string;
      ch1TitleEn: string;
      ch1Body: string;
      ch1BodyEn: string;
      ch2Title: string;
      ch2TitleEn: string;
    }
  > = {
    "silent-latitudes": {
      ch1Title: "冰河与破晓薄雾",
      ch1TitleEn: "Glaciers & Dawn Mist",
      ch1Body: "日出前后的高纬河谷与冰川湖面，冷色调水汽在风停的片刻凝成镜面。",
      ch1BodyEn: "High-latitude valleys and glacial lakes before sunrise, where cold mist settles into still mirrors.",
      ch2Title: "雪线之上的静默",
      ch2TitleEn: "Above the Snowline",
    },
    "urban-nocturne": {
      ch1Title: "暮色初灯与街巷",
      ch1TitleEn: "Blue Hour & Lantern Streets",
      ch1Body: "当日落余晖与街头霓虹短暂交汇，行人的步履在湿润石板与斑马线上拉出剪影。",
      ch1BodyEn: "Where fading dusk meets early neon, footsteps cast quiet silhouettes across wet stone and crosswalks.",
      ch2Title: "黑钢、红砖与秩序",
      ch2TitleEn: "Steel, Brick & Geometry",
    },
    "coast-and-horizon": {
      ch1Title: "晨雾河谷与荒原公路",
      ch1TitleEn: "Valley Fog & Open Asphalt",
      ch1Body: "顺着山谷晨光与笔直公路向大陆边缘推进，记录旅途中空旷而缓慢的时刻。",
      ch1BodyEn: "Following valley light and desert highways toward the continental edge.",
      ch2Title: "远岸涌浪与余晖",
      ch2TitleEn: "Ocean Swell & Last Light",
    },
  };

  for (const col of existingCols) {
    const needsChapterOneUpgrade =
      !col.blocksJson ||
      (col.blocksJson.includes(`"cov-mid-${col.id}"`) && !col.blocksJson.includes(`"cov-ch1-${col.id}"`));
    if (!needsChapterOneUpgrade) continue;

    const colLinks = existingLinks
      .filter((l) => l.collectionId === col.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const colPhotos = colLinks.map((l) => pMap.get(l.photoId)).filter((p): p is schema.Photo => Boolean(p));
    if (colPhotos.length === 0) continue;

    const meta = chapterMeta[col.slug] || {
      ch1Title: "第一乐章",
      ch1TitleEn: "First Movement",
      ch1Body: col.description,
      ch1BodyEn: col.descriptionEn,
      ch2Title: "第二乐章",
      ch2TitleEn: "Second Movement",
    };

    const midIdx = Math.floor(colPhotos.length / 2);
    const blocks = [
      {
        id: `cov-open-${col.id}`,
        kind: "cover",
        style: "full",
        imageUrl: col.coverUrl || colPhotos[0].url,
        eyebrow: col.period,
        eyebrowEn: col.period,
        title: col.title,
        titleEn: col.titleEn,
        body: col.description,
        bodyEn: col.descriptionEn,
      },
      {
        id: `cov-ch1-${col.id}`,
        kind: "cover",
        style: "minimal",
        imageUrl: "",
        eyebrow: "CHAPTER I",
        eyebrowEn: "CHAPTER I",
        title: meta.ch1Title,
        titleEn: meta.ch1TitleEn,
        body: meta.ch1Body,
        bodyEn: meta.ch1BodyEn,
      },
      ...colPhotos.slice(0, midIdx).map((p, idx) => ({
        id: `ph-${p.id}`,
        kind: "photo",
        photoId: p.id,
        sideNote: idx === 1 ? p.description : "",
        sideNoteEn: idx === 1 ? p.descriptionEn : "",
        noteAlign: "right",
      })),
      {
        id: `cov-mid-${col.id}`,
        kind: "cover",
        style: "split",
        imageUrl: colPhotos[midIdx]?.url || col.coverUrl,
        eyebrow: "CHAPTER II",
        eyebrowEn: "CHAPTER II",
        title: meta.ch2Title,
        titleEn: meta.ch2TitleEn,
        body: colPhotos[midIdx]?.description || col.description,
        bodyEn: colPhotos[midIdx]?.descriptionEn || col.descriptionEn,
      },
      ...colPhotos.slice(midIdx).map((p, idx) => ({
        id: `ph-${p.id}`,
        kind: "photo",
        photoId: p.id,
        sideNote: idx === 1 ? p.description : "",
        sideNoteEn: idx === 1 ? p.descriptionEn : "",
        noteAlign: "left",
      })),
    ];

    await db
      .update(schema.collections)
      .set({ blocksJson: JSON.stringify(blocks) })
      .where(eq(schema.collections.id, col.id));
  }

  await db
    .insert(schema.siteSettings)
    .values({ key: "schema_v4", value: "1" })
    .onConflictDoUpdate({ target: schema.siteSettings.key, set: { value: "1" } });
}
