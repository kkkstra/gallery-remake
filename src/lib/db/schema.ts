import { sqliteTable, integer, text, real, primaryKey } from "drizzle-orm/sqlite-core";

export const photos = sqliteTable("photos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  titleEn: text("title_en").notNull().default(""),
  description: text("description").notNull().default(""),
  descriptionEn: text("description_en").notNull().default(""),
  url: text("url").notNull(),
  width: integer("width").notNull().default(1600),
  height: integer("height").notNull().default(1068),
  ambient: text("ambient").notNull().default("#1e2024"),
  blurData: text("blur_data").notNull().default(""),
  category: text("category").notNull().default("landscape"),
  featured: integer("featured", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  takenAt: text("taken_at").notNull().default(""),
  location: text("location").notNull().default(""),
  locationEn: text("location_en").notNull().default(""),
  lat: real("lat"),
  lng: real("lng"),
  camera: text("camera").notNull().default(""),
  lens: text("lens").notNull().default(""),
  focalMm: integer("focal_mm"),
  aperture: text("aperture").notNull().default(""),
  shutter: text("shutter").notNull().default(""),
  iso: integer("iso"),
  createdAt: text("created_at").notNull(),
});

export const collections = sqliteTable("collections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  titleEn: text("title_en").notNull().default(""),
  description: text("description").notNull().default(""),
  descriptionEn: text("description_en").notNull().default(""),
  coverUrl: text("cover_url").notNull().default(""),
  period: text("period").notNull().default(""),
  blocksJson: text("blocks_json").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const collectionPhotos = sqliteTable(
  "collection_photos",
  {
    collectionId: integer("collection_id").notNull(),
    photoId: integer("photo_id").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.collectionId, t.photoId] })]
);

export const gear = sqliteTable("gear", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull().default("camera"), // camera | lens
  brand: text("brand").notNull().default(""),
  name: text("name").notNull(),
  specs: text("specs").notNull().default(""),
  note: text("note").notNull().default(""),
  noteEn: text("note_en").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const siteSettings = sqliteTable("site_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type Photo = typeof photos.$inferSelect;
export type NewPhoto = typeof photos.$inferInsert;
export type Collection = typeof collections.$inferSelect;
export type GearItem = typeof gear.$inferSelect;
