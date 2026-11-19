import type { Photo } from "./db/schema";

export type CoverStyle = "full" | "split" | "minimal";

export interface MonographCoverBlock {
  id: string;
  kind: "cover";
  style: CoverStyle;
  imageUrl: string;
  eyebrow: string;
  eyebrowEn: string;
  title: string;
  titleEn: string;
  body: string;
  bodyEn: string;
}

export interface MonographPhotoBlock {
  id: string;
  kind: "photo";
  photoId: number;
  sideNote: string;
  sideNoteEn: string;
  noteAlign: "right" | "left";
}

export type MonographBlock = MonographCoverBlock | MonographPhotoBlock;

export function parseMonographBlocks(
  blocksJson: string | undefined | null,
  fallback: {
    title: string;
    titleEn: string;
    description: string;
    descriptionEn: string;
    coverUrl: string;
    period: string;
    photos: Photo[];
  }
): MonographBlock[] {
  const validPhotoIds = new Set(fallback.photos.map((p) => p.id));

  if (blocksJson && blocksJson.trim()) {
    try {
      const parsed = JSON.parse(blocksJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const seenPhotos = new Set<number>();
        const cleaned: MonographBlock[] = [];
        for (const raw of parsed) {
          if (raw?.kind === "cover") {
            cleaned.push({
              id: String(raw.id || `cov-${cleaned.length}`),
              kind: "cover",
              style: raw.style === "split" || raw.style === "minimal" ? raw.style : "full",
              imageUrl: String(raw.imageUrl || ""),
              eyebrow: String(raw.eyebrow || ""),
              eyebrowEn: String(raw.eyebrowEn || ""),
              title: String(raw.title || ""),
              titleEn: String(raw.titleEn || ""),
              body: String(raw.body || ""),
              bodyEn: String(raw.bodyEn || ""),
            });
          } else if (raw?.kind === "photo" && validPhotoIds.has(Number(raw.photoId))) {
            const pid = Number(raw.photoId);
            if (!seenPhotos.has(pid)) {
              seenPhotos.add(pid);
              cleaned.push({
                id: String(raw.id || `ph-${pid}`),
                kind: "photo",
                photoId: pid,
                sideNote: String(raw.sideNote || ""),
                sideNoteEn: String(raw.sideNoteEn || ""),
                noteAlign: raw.noteAlign === "left" ? "left" : "right",
              });
            }
          }
        }
        // Append any linked photos not yet present in blocks
        for (const p of fallback.photos) {
          if (!seenPhotos.has(p.id)) {
            cleaned.push({
              id: `ph-${p.id}`,
              kind: "photo",
              photoId: p.id,
              sideNote: "",
              sideNoteEn: "",
              noteAlign: "right",
            });
          }
        }
        if (cleaned.length > 0) return cleaned;
      }
    } catch {
      // Fallback to default structure
    }
  }

  return [
    {
      id: "cover-opening",
      kind: "cover",
      style: "full",
      imageUrl: fallback.coverUrl || fallback.photos[0]?.url || "",
      eyebrow: fallback.period,
      eyebrowEn: fallback.period,
      title: fallback.title,
      titleEn: fallback.titleEn,
      body: fallback.description,
      bodyEn: fallback.descriptionEn,
    },
    ...fallback.photos.map(
      (p): MonographPhotoBlock => ({
        id: `ph-${p.id}`,
        kind: "photo",
        photoId: p.id,
        sideNote: "",
        sideNoteEn: "",
        noteAlign: "right",
      })
    ),
  ];
}
