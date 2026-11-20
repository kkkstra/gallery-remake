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
  customTitle?: string;
  customTitleEn?: string;
  sideNote: string;
  sideNoteEn: string;
  noteAlign: "right" | "left";
}

export type MonographBlock = MonographCoverBlock | MonographPhotoBlock;

export type PhotoTitleOverrideInput =
  | string
  | {
      customTitle?: string;
      customTitleEn?: string;
      title?: string;
      titleEn?: string;
      sideNote?: string;
      sideNoteEn?: string;
      noteAlign?: "right" | "left";
    };

export function sanitizeRawMonographBlocks(rawBlocks: unknown[]): MonographBlock[] {
  const seenPhotos = new Set<number>();
  const cleaned: MonographBlock[] = [];
  for (const item of rawBlocks) {
    const raw = item as Record<string, unknown> | null;
    if (!raw || typeof raw !== "object") continue;
    if (raw.kind === "cover") {
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
    } else if (raw.kind === "photo" && Number.isFinite(Number(raw.photoId)) && Number(raw.photoId) > 0) {
      const pid = Number(raw.photoId);
      if (!seenPhotos.has(pid)) {
        seenPhotos.add(pid);
        cleaned.push({
          id: String(raw.id || `ph-${pid}`),
          kind: "photo",
          photoId: pid,
          customTitle: String(raw.customTitle ?? raw.title ?? ""),
          customTitleEn: String(raw.customTitleEn ?? raw.titleEn ?? ""),
          sideNote: String(raw.sideNote || ""),
          sideNoteEn: String(raw.sideNoteEn || ""),
          noteAlign: raw.noteAlign === "left" ? "left" : "right",
        });
      }
    }
  }
  return cleaned;
}

export function applyPhotoTitleOverrides(
  blocks: MonographBlock[],
  photoTitles: Record<string, PhotoTitleOverrideInput>
): MonographBlock[] {
  return blocks.map((b) => {
    if (b.kind !== "photo") return b;
    const ov = photoTitles[String(b.photoId)];
    if (ov === undefined) return b;
    if (typeof ov === "string") {
      return { ...b, customTitle: ov };
    }
    if (ov && typeof ov === "object") {
      const nextCustomTitle =
        "customTitle" in ov ? String(ov.customTitle ?? "") : "title" in ov ? String(ov.title ?? "") : b.customTitle;
      const nextCustomTitleEn =
        "customTitleEn" in ov
          ? String(ov.customTitleEn ?? "")
          : "titleEn" in ov
            ? String(ov.titleEn ?? "")
            : b.customTitleEn;
      return {
        ...b,
        customTitle: nextCustomTitle ?? "",
        customTitleEn: nextCustomTitleEn ?? "",
        sideNote: "sideNote" in ov ? String(ov.sideNote ?? "") : b.sideNote,
        sideNoteEn: "sideNoteEn" in ov ? String(ov.sideNoteEn ?? "") : b.sideNoteEn,
        noteAlign: ov.noteAlign === "left" || ov.noteAlign === "right" ? ov.noteAlign : b.noteAlign,
      };
    }
    return b;
  });
}

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
                customTitle: String(raw.customTitle ?? raw.title ?? ""),
                customTitleEn: String(raw.customTitleEn ?? raw.titleEn ?? ""),
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
              customTitle: "",
              customTitleEn: "",
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
        customTitle: "",
        customTitleEn: "",
        sideNote: "",
        sideNoteEn: "",
        noteAlign: "right",
      })
    ),
  ];
}

export function serializeAdminCollection<
  T extends {
    title: string;
    titleEn: string;
    description: string;
    descriptionEn: string;
    coverUrl: string;
    period: string;
    blocksJson: string;
    photos: Photo[];
  },
>(col: T) {
  const blocks = parseMonographBlocks(col.blocksJson, col);
  const photoBlockMap = new Map<number, MonographPhotoBlock>();
  const photoTitles: Record<number, { customTitle: string; customTitleEn: string }> = {};
  for (const b of blocks) {
    if (b.kind === "photo") {
      photoBlockMap.set(b.photoId, b);
      if (b.customTitle?.trim() || b.customTitleEn?.trim()) {
        photoTitles[b.photoId] = {
          customTitle: b.customTitle || "",
          customTitleEn: b.customTitleEn || "",
        };
      }
    }
  }
  return {
    ...col,
    blocks,
    photoTitles,
    photos: col.photos.map((p) => {
      const b = photoBlockMap.get(p.id);
      const customTitle = b?.customTitle?.trim() || "";
      const customTitleEn = b?.customTitleEn?.trim() || "";
      return {
        ...p,
        customTitle,
        customTitleEn,
        displayTitle: customTitle || p.title,
        displayTitleEn: customTitleEn || p.titleEn,
      };
    }),
  };
}
