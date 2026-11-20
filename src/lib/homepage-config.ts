import type { Photo } from "./db/schema";
import type { CollectionWithPhotos } from "./queries";
import {
  buildGroupMap,
  collapsePhotoListForDisplay,
  type DisplayPhotoCard,
} from "./photo-groups";

export function parseOptionalIdList(raw?: string | null): number[] | null {
  if (!raw || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const seen = new Set<number>();
    const out: number[] = [];
    for (const v of parsed) {
      const n = Number(v);
      if (Number.isInteger(n) && n > 0 && !seen.has(n)) {
        seen.add(n);
        out.push(n);
      }
    }
    return out;
  } catch {
    return null;
  }
}

export function serializeOptionalIdList(ids: number[] | null | undefined): string {
  if (ids === null || ids === undefined) return "";
  const seen = new Set<number>();
  const clean: number[] = [];
  for (const v of ids) {
    const n = Number(v);
    if (Number.isInteger(n) && n > 0 && !seen.has(n)) {
      seen.add(n);
      clean.push(n);
    }
  }
  return JSON.stringify(clean);
}

export function resolveHomepageSections(
  allPhotos: Photo[],
  collections: CollectionWithPhotos[],
  settings: Record<string, string>
): {
  heroSlides: Photo[];
  isCustomFeatured: boolean;
  curatedCollections: CollectionWithPhotos[];
  isCustomCollections: boolean;
  galleryCards: DisplayPhotoCard[];
  galleryLightboxPhotos: Photo[];
  isCustomGallery: boolean;
} {
  const photoMap = new Map(allPhotos.map((p) => [p.id, p]));
  const colMap = new Map(collections.map((c) => [c.id, c]));
  const fullGroupMap = buildGroupMap(allPhotos);

  // 1. Hero Featured Carousel
  const defaultHeroPool = () => {
    const wide = allPhotos.filter((p) => (p.width || 1600) >= (p.height || 1068)).slice(0, 8);
    return wide.length >= 2 ? wide : allPhotos.slice(0, 8);
  };
  const customFeaturedIds = parseOptionalIdList(settings.homeFeaturedIds);
  let heroSlides: Photo[];
  let isCustomFeatured = false;
  if (customFeaturedIds !== null) {
    const picked = customFeaturedIds
      .map((id) => photoMap.get(id))
      .filter((p): p is Photo => Boolean(p));
    if (picked.length > 0) {
      heroSlides = picked;
      isCustomFeatured = true;
    } else {
      heroSlides = defaultHeroPool();
    }
  } else {
    heroSlides = defaultHeroPool();
  }

  // 2. Homepage Series / Collections
  const customColIds = parseOptionalIdList(settings.homeCollectionIds);
  const isCustomCollections = customColIds !== null;
  const curatedCollections =
    customColIds !== null
      ? customColIds
          .map((id) => colMap.get(id))
          .filter((c): c is CollectionWithPhotos => Boolean(c))
      : collections;

  // 3. Homepage Gallery Mosaic
  const customGalleryIds = parseOptionalIdList(settings.homeGalleryIds);
  const isCustomGallery = customGalleryIds !== null;
  if (customGalleryIds === null) {
    const { cards, lightboxPhotos } = collapsePhotoListForDisplay(allPhotos);
    return {
      heroSlides,
      isCustomFeatured,
      curatedCollections,
      isCustomCollections,
      galleryCards: cards.slice(0, 8),
      galleryLightboxPhotos: lightboxPhotos,
      isCustomGallery: false,
    };
  }

  const pickedPhotos = customGalleryIds
    .map((id) => photoMap.get(id))
    .filter((p): p is Photo => Boolean(p));

  // Count how many members of each groupId were explicitly picked
  const groupPickCounts = new Map<string, number>();
  for (const p of pickedPhotos) {
    if (p.groupId && fullGroupMap.has(p.id)) {
      groupPickCounts.set(p.groupId, (groupPickCounts.get(p.groupId) || 0) + 1);
    }
  }

  const galleryCards: DisplayPhotoCard[] = [];
  const galleryLightboxPhotos: Photo[] = [];

  for (const p of pickedPhotos) {
    const gInfo = fullGroupMap.get(p.id);
    if (gInfo && (groupPickCounts.get(gInfo.groupId) || 0) === 1) {
      // Single representative of a multi-photo group -> render as stacked cover card & load full group into Lightbox
      const startIdx = galleryLightboxPhotos.length;
      const offsetInGroup = Math.max(
        0,
        gInfo.siblings.findIndex((s) => s.id === p.id)
      );
      galleryLightboxPhotos.push(...gInfo.siblings);
      galleryCards.push({
        photo: p,
        flatIdx: startIdx + offsetInGroup,
        groupTotal: gInfo.total,
        groupIndex: gInfo.index,
        isStackedCover: true,
        groupPhotos: gInfo.siblings,
      });
    } else if (gInfo) {
      const flatIdx = galleryLightboxPhotos.length;
      galleryLightboxPhotos.push(p);
      galleryCards.push({
        photo: p,
        flatIdx,
        groupTotal: gInfo.total,
        groupIndex: gInfo.index,
        isStackedCover: false,
        groupPhotos: gInfo.siblings,
      });
    } else {
      const flatIdx = galleryLightboxPhotos.length;
      galleryLightboxPhotos.push(p);
      galleryCards.push({
        photo: p,
        flatIdx,
        groupTotal: 1,
        groupIndex: 1,
        isStackedCover: false,
        groupPhotos: [p],
      });
    }
  }

  return {
    heroSlides,
    isCustomFeatured,
    curatedCollections,
    isCustomCollections,
    galleryCards,
    galleryLightboxPhotos,
    isCustomGallery: true,
  };
}
