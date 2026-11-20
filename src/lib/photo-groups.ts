import type { Photo } from "./db/schema";

export interface PhotoGroupInfo {
  groupId: string;
  index: number; // 1-based index within visible siblings
  total: number;
  siblings: Photo[];
  isExpanded: boolean;
}

export interface DisplayPhotoCard {
  photo: Photo;
  flatIdx: number; // index inside lightboxPhotos
  groupTotal: number;
  groupIndex: number;
  isStackedCover: boolean;
  groupPhotos: Photo[];
}

export function generateGroupId(): string {
  return `grp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Builds a lookup from photo.id -> PhotoGroupInfo for all groups that have >= 2 photos in `list`.
 * Singletons (groups with only 1 visible photo) gracefully behave as normal standalone photos.
 */
export function buildGroupMap(list: Photo[]): Map<number, PhotoGroupInfo> {
  const buckets = new Map<string, Photo[]>();
  for (const p of list) {
    if (!p.groupId) continue;
    const arr = buckets.get(p.groupId);
    if (arr) arr.push(p);
    else buckets.set(p.groupId, [p]);
  }

  const map = new Map<number, PhotoGroupInfo>();
  for (const [groupId, members] of buckets) {
    if (members.length < 2) continue;
    const sorted = [...members].sort((a, b) => a.groupOrder - b.groupOrder || a.id - b.id);
    const isExpanded = Boolean(sorted[0]?.groupExpanded);
    sorted.forEach((p, idx) => {
      map.set(p.id, {
        groupId,
        index: idx + 1,
        total: sorted.length,
        siblings: sorted,
        isExpanded,
      });
    });
  }
  return map;
}

/**
 * Formats a photo title with 1-based frame number ("八坂暮色 1") when part of a multi-photo group.
 */
export function formatNumberedTitle(
  baseTitle: string,
  groupInfo?: { index: number; total: number } | null
): string {
  if (!baseTitle) return "";
  if (!groupInfo || groupInfo.total <= 1) return baseTitle;
  return `${baseTitle} ${groupInfo.index}`;
}

/**
 * Clusters group siblings contiguously at the position of the group's first occurrence in `sortedList`,
 * ordered by `groupOrder` (1 -> 2 -> 3...), and produces both:
 *  - `lightboxPhotos`: full contiguous frame list so <- / -> steps 1 -> 2 -> 3 -> next work seamlessly
 *  - `cards`: visual card entries (stacked into 1 cover card unless expanded)
 */
export function collapsePhotoListForDisplay(
  sortedList: Photo[],
  opts?: { forceExpandAll?: boolean; alwaysStack?: boolean }
): { cards: DisplayPhotoCard[]; lightboxPhotos: Photo[] } {
  const buckets = new Map<string, Photo[]>();
  for (const p of sortedList) {
    if (!p.groupId) continue;
    const arr = buckets.get(p.groupId);
    if (arr) arr.push(p);
    else buckets.set(p.groupId, [p]);
  }

  for (const [gid, arr] of buckets) {
    if (arr.length < 2) {
      buckets.delete(gid);
    } else {
      arr.sort((a, b) => a.groupOrder - b.groupOrder || a.id - b.id);
    }
  }

  const lightboxPhotos: Photo[] = [];
  const cards: DisplayPhotoCard[] = [];
  const emittedGroups = new Set<string>();

  for (const p of sortedList) {
    const siblings = p.groupId ? buckets.get(p.groupId) : undefined;
    if (!siblings) {
      const flatIdx = lightboxPhotos.length;
      lightboxPhotos.push(p);
      cards.push({
        photo: p,
        flatIdx,
        groupTotal: 1,
        groupIndex: 1,
        isStackedCover: false,
        groupPhotos: [p],
      });
      continue;
    }

    if (emittedGroups.has(p.groupId)) continue;
    emittedGroups.add(p.groupId);

    const startFlatIdx = lightboxPhotos.length;
    lightboxPhotos.push(...siblings);

    const shouldExpand =
      !opts?.alwaysStack && Boolean(opts?.forceExpandAll || siblings[0]?.groupExpanded);

    if (shouldExpand) {
      siblings.forEach((member, idx) => {
        cards.push({
          photo: member,
          flatIdx: startFlatIdx + idx,
          groupTotal: siblings.length,
          groupIndex: idx + 1,
          isStackedCover: false,
          groupPhotos: siblings,
        });
      });
    } else {
      cards.push({
        photo: siblings[0],
        flatIdx: startFlatIdx,
        groupTotal: siblings.length,
        groupIndex: 1,
        isStackedCover: true,
        groupPhotos: siblings,
      });
    }
  }

  return { cards, lightboxPhotos };
}
