"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Aperture, ArrowLeft, Compass, Globe2, MapPin, Minus, Plus } from "lucide-react";
import type { Photo } from "@/lib/db/schema";
import { collapsePhotoListForDisplay, formatNumberedTitle } from "@/lib/photo-groups";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { Lightbox } from "./Lightbox";
import { GalleryImage } from "./GalleryImage";
import { loadCompliantMapStyle } from "@/lib/compliant-map-style";
import { optImg } from "@/lib/image-url";
import { usePreferences } from "./PreferencesProvider";

interface MapClientProps {
  photos: Photo[];
  collectionsMap: Record<number, { slug: string; title: string; titleEn: string }[]>;
  settings: Record<string, string>;
}

type GeoPhoto = Photo & { lat: number; lng: number };

interface CityGroup {
  key: string;
  lat: number;
  lng: number;
  location: string;
  locationEn: string;
  photos: GeoPhoto[];
}

interface MapPinGroup {
  id: string;
  cityKey: string | null; // non-null if all photos in this marker belong to the same city
  lat: number;
  lng: number;
  location: string;
  locationEn: string;
  photos: GeoPhoto[];
}

type MapSelection =
  | { kind: "city"; cityKey: string }
  | { kind: "pin"; photoIds: number[] }
  | null;

const COUNTRY_OR_PROVINCE_RE =
  /^(中国|中华人民共和国|日本|美国|英国|法国|德国|意大利|瑞士|冰岛|加拿大|新西兰|澳大利亚|韩国|新加坡|泰国|西班牙|挪威|瑞典|芬兰|奥地利|荷兰|葡萄牙|希腊|土耳其|埃及|摩洛哥|马来西亚|印度尼西亚|越南|尼泊尔|北海道|苏格兰|英格兰|.+省|.+自治区|广东|浙江|江苏|四川|云南|西藏|新疆|青海|甘肃|陕西|山东|山西|河南|河北|湖南|湖北|江西|安徽|福建|广西|海南|贵州|辽宁|吉林|黑龙江|内蒙古|宁夏|台湾)$/;

const COUNTRY_ONLY_RE =
  /^(中国|中华人民共和国|日本|美国|英国|法国|德国|意大利|瑞士|冰岛|加拿大|新西兰|澳大利亚|韩国|新加坡|泰国|西班牙|挪威|瑞典|芬兰|奥地利|荷兰|葡萄牙|希腊)$/;

function normalizeZhCityToken(raw: string): string {
  return raw
    .trim()
    .replace(/特别行政区$/, "")
    .replace(/^(东京|京都|大阪)[都府]$/, "$1")
    .replace(/^(.{2,})市$/, "$1");
}

function extractCityMeta(p: GeoPhoto): {
  key: string | null;
  cityZh: string;
  countryZh: string;
  hasSubSpot: boolean;
  cleanEn: string;
} {
  const rawZh = (p.location || "").trim();
  const rawEn = (p.locationEn || "").trim();

  if (rawZh) {
    const commaParts = rawZh.split(/\s*[,，]\s*/).filter(Boolean);
    let cityPart = commaParts[0] || rawZh;
    let countryZh = commaParts[1] || "";
    if (commaParts.length >= 2 && COUNTRY_ONLY_RE.test(commaParts[0])) {
      countryZh = commaParts[0];
      cityPart = commaParts[1];
    }

    const hasCjk = /[\u4e00-\u9fff]/.test(cityPart);
    const subParts = (
      hasCjk ? cityPart.split(/\s*[·•｜|/\s-]+\s*/) : cityPart.split(/\s*[·•｜|/]\s*/)
    ).filter(Boolean);

    let chosen = subParts[0] || cityPart;
    let hasSubSpot = subParts.length > 1;
    if (subParts.length >= 2 && COUNTRY_OR_PROVINCE_RE.test(subParts[0])) {
      if (!countryZh && COUNTRY_ONLY_RE.test(subParts[0])) countryZh = subParts[0];
      chosen = subParts[1];
      hasSubSpot = subParts.length > 2;
    }

    const cityZh = normalizeZhCityToken(chosen);
    const enParts = rawEn.split(/\s*,\s*/).filter(Boolean);
    const cleanEn =
      enParts.length >= 3 ? enParts.slice(-2).join(", ") : rawEn;

    return {
      key: `city:${cityZh.toLowerCase()}`,
      cityZh,
      countryZh,
      hasSubSpot,
      cleanEn,
    };
  }

  if (rawEn) {
    const enParts = rawEn.split(/\s*,\s*/).filter(Boolean);
    const cityEn = (enParts.length >= 3 ? enParts[enParts.length - 2] : enParts[0]).trim();
    const cleanEn = enParts.length >= 3 ? enParts.slice(-2).join(", ") : rawEn;
    return {
      key: `city:${cityEn.toLowerCase()}`,
      cityZh: cleanEn,
      countryZh: "",
      hasSubSpot: enParts.length >= 3,
      cleanEn,
    };
  }

  return { key: null, cityZh: "未知地点", countryZh: "", hasSubSpot: false, cleanEn: "Unknown" };
}

function formatCoord(lat: number, lng: number, detailed = false): string {
  const digits = detailed ? 4 : 2;
  return `${Math.abs(lat).toFixed(digits)}°${lat >= 0 ? "N" : "S"}, ${Math.abs(lng).toFixed(digits)}°${lng >= 0 ? "E" : "W"}`;
}

function getClusterRadiusDeg(zoom: number): number {
  if (zoom <= 2.5) return 0.45; // ~48km: clean regional/metro clusters at world view
  return Math.max(0.0003, 0.45 / Math.pow(2, zoom - 2.5)); // ~30m floor so same-spot photos stay grouped as one pin
}

export function MapClient({ photos, collectionsMap, settings }: MapClientProps) {
  const { locale, theme, pick } = usePreferences();
  const searchParams = useSearchParams();
  const focusPhotoId = Number(searchParams.get("focus") || 0);
  const qLat = searchParams.get("lat");
  const qLng = searchParams.get("lng");
  const qZoom = searchParams.get("z");

  const geoPhotos = useMemo(
    () => photos.filter((p): p is GeoPhoto => p.lat !== null && p.lng !== null),
    [photos]
  );

  // 1. Invariant Sidebar City Directory — grouped strictly by city name, independent of map zoom
  const { cityGroups, photoCityKeyMap } = useMemo(() => {
    const byKey = new Map<
      string,
      {
        key: string;
        lat: number;
        lng: number;
        cityZh: string;
        countryZh: string;
        exactLabelZh: string;
        cleanEn: string;
        photos: GeoPhoto[];
      }
    >();
    const unnamedGroups: typeof byKey extends Map<string, infer V> ? V[] : never = [];
    const keyByPhotoId = new Map<number, string>();

    for (const p of geoPhotos) {
      const meta = extractCityMeta(p);
      if (meta.key) {
        let g = byKey.get(meta.key);
        if (!g) {
          g = {
            key: meta.key,
            lat: p.lat,
            lng: p.lng,
            cityZh: meta.cityZh,
            countryZh: meta.countryZh,
            exactLabelZh: !meta.hasSubSpot && p.location ? p.location.trim() : "",
            cleanEn: meta.cleanEn,
            photos: [p],
          };
          byKey.set(meta.key, g);
        } else {
          const n = g.photos.length;
          g.lat = (g.lat * n + p.lat) / (n + 1);
          g.lng = (g.lng * n + p.lng) / (n + 1);
          if (!g.countryZh && meta.countryZh) g.countryZh = meta.countryZh;
          if (!g.exactLabelZh && !meta.hasSubSpot && p.location) g.exactLabelZh = p.location.trim();
          if (!g.cleanEn && meta.cleanEn) g.cleanEn = meta.cleanEn;
          g.photos.push(p);
        }
        keyByPhotoId.set(p.id, meta.key);
      } else {
        // Unnamed GPS-only photos: group by ~28km city proximity
        const near = unnamedGroups.find((u) => Math.hypot(u.lat - p.lat, u.lng - p.lng) < 0.25);
        if (near) {
          const n = near.photos.length;
          near.lat = (near.lat * n + p.lat) / (n + 1);
          near.lng = (near.lng * n + p.lng) / (n + 1);
          near.photos.push(p);
          keyByPhotoId.set(p.id, near.key);
        } else {
          const uKey = `gps:${p.id}`;
          unnamedGroups.push({
            key: uKey,
            lat: p.lat,
            lng: p.lng,
            cityZh: "未知地点",
            countryZh: "",
            exactLabelZh: "",
            cleanEn: "Unknown",
            photos: [p],
          });
          keyByPhotoId.set(p.id, uKey);
        }
      }
    }

    const allRaw = [...byKey.values(), ...unnamedGroups];
    const list: CityGroup[] = allRaw
      .map((g) => {
        const location =
          g.exactLabelZh || (g.countryZh ? `${g.cityZh}, ${g.countryZh}` : g.cityZh);
        const locationEn = g.cleanEn || location;
        return {
          key: g.key,
          lat: g.lat,
          lng: g.lng,
          location,
          locationEn,
          photos: g.photos,
        };
      })
      .sort((a, b) => b.photos.length - a.photos.length);

    return { cityGroups: list, photoCityKeyMap: keyByPhotoId };
  }, [geoPhotos]);

  const cityByKey = useMemo(() => {
    const m = new Map<string, CityGroup>();
    for (const c of cityGroups) m.set(c.key, c);
    return m;
  }, [cityGroups]);

  const initialZoom = qZoom !== null ? Number(qZoom) : focusPhotoId > 0 ? 11.5 : 1.65;
  const [zoomBucket, setZoomBucket] = useState<number>(() => Math.round(initialZoom * 2) / 2);

  // 2. Dynamic Map Canvas Pins — merges same-city pins at low zoom, unclusters into distinct spots on zoom-in,
  //    while ALWAYS keeping same-coordinate (and same-series) photos grouped into a single pin with a count badge.
  const mapPins = useMemo<MapPinGroup[]>(() => {
    const radius = getClusterRadiusDeg(zoomBucket);
    const mergeSameCity = zoomBucket < 8.5;
    const groups: MapPinGroup[] = [];

    for (const p of geoPhotos) {
      const pCityKey = photoCityKeyMap.get(p.id) || null;
      const match = groups.find((g) => {
        if (p.groupId && g.photos.some((m) => m.groupId === p.groupId)) {
          return Math.hypot(g.lat - p.lat, g.lng - p.lng) < 0.02;
        }
        if (mergeSameCity && pCityKey && g.cityKey === pCityKey) {
          // Merge same-city spots at overview zoom (guarding against cross-continent coordinate typos)
          return Math.hypot(g.lat - p.lat, g.lng - p.lng) < 2.5;
        }
        return Math.hypot(g.lat - p.lat, g.lng - p.lng) < radius;
      });

      if (match) {
        const n = match.photos.length;
        match.lat = (match.lat * n + p.lat) / (n + 1);
        match.lng = (match.lng * n + p.lng) / (n + 1);
        if (match.cityKey !== pCityKey) match.cityKey = null;
        match.photos.push(p);
      } else {
        const city = pCityKey ? cityByKey.get(pCityKey) : undefined;
        const useSpotLabel = zoomBucket >= 10 && p.location;
        groups.push({
          id: `m_${p.id}`,
          cityKey: pCityKey,
          lat: p.lat,
          lng: p.lng,
          location: (useSpotLabel ? p.location : city?.location || p.location) || "未知地点",
          locationEn:
            (useSpotLabel ? p.locationEn || p.location : city?.locationEn || p.locationEn || p.location) ||
            "Unknown",
          photos: [p],
        });
      }
    }
    return groups.sort((a, b) => b.photos.length - a.photos.length);
  }, [cityByKey, geoPhotos, photoCityKeyMap, zoomBucket]);

  const [selection, setSelection] = useState<MapSelection>(() => {
    if (focusPhotoId > 0) {
      const target = geoPhotos.find((p) => p.id === focusPhotoId);
      if (target) {
        const sameSpotIds = geoPhotos
          .filter(
            (p) =>
              Math.hypot(p.lat - target.lat, p.lng - target.lng) < 0.00035 ||
              Boolean(target.groupId && p.groupId === target.groupId)
          )
          .map((p) => p.id);
        return { kind: "pin", photoIds: sameSpotIds.length > 0 ? sameSpotIds : [focusPhotoId] };
      }
      return { kind: "pin", photoIds: [focusPhotoId] };
    }
    return null;
  });
  const [lightboxList, setLightboxList] = useState<Photo[]>(geoPhotos);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<
    Map<string, { marker: maplibregl.Marker; wrap: HTMLDivElement; btn: HTMLButtonElement; photoIds: number[] }>
  >(new Map());
  const styleKeyRef = useRef("");

  const activeDetail = useMemo(() => {
    if (!selection) return null;
    if (selection.kind === "city") {
      const city = cityByKey.get(selection.cityKey);
      if (!city) return null;
      return {
        location: city.location,
        locationEn: city.locationEn,
        lat: city.lat,
        lng: city.lng,
        photos: city.photos,
        parentCity: null as CityGroup | null,
        detailedCoord: false,
      };
    }
    const idSet = new Set(selection.photoIds);
    const matched = geoPhotos.filter((p) => idSet.has(p.id));
    if (matched.length === 0) return null;
    const first = matched[0];
    const cKey = photoCityKeyMap.get(first.id);
    const parentCity = cKey ? cityByKey.get(cKey) ?? null : null;
    return {
      location: first.location || parentCity?.location || first.title,
      locationEn: first.locationEn || parentCity?.locationEn || first.titleEn || first.title,
      lat: first.lat,
      lng: first.lng,
      photos: matched,
      parentCity: parentCity && parentCity.photos.length > matched.length ? parentCity : null,
      detailedCoord: true,
    };
  }, [cityByKey, geoPhotos, photoCityKeyMap, selection]);

  const activePhotoIdSet = useMemo(
    () => new Set(activeDetail ? activeDetail.photos.map((p) => p.id) : []),
    [activeDetail]
  );

  const flyToPhotos = (list: GeoPhoto[], minSingleZoom = 11.5) => {
    const map = mapRef.current;
    if (!map || list.length === 0) return;

    const curZ = map.getZoom();
    if (list.length === 1) {
      map.flyTo({
        center: [list[0].lng, list[0].lat],
        zoom: Math.max(curZ, minSingleZoom),
        duration: 820,
        essential: true,
      });
      return;
    }

    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;
    for (const p of list) {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    }
    const span = Math.max(maxLat - minLat, maxLng - minLng);
    if (span < 0.0004) {
      map.flyTo({
        center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2],
        zoom: Math.max(curZ, 12.5),
        duration: 820,
        essential: true,
      });
      return;
    }

    map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      { padding: 88, maxZoom: 13.5, duration: 850, essential: true }
    );
  };

  const selectCityGroup = (city: CityGroup) => {
    setSelection({ kind: "city", cityKey: city.key });
    flyToPhotos(city.photos, 11.5);
  };

  const handlePinClick = (pin: MapPinGroup) => {
    const map = mapRef.current;
    const curZ = map?.getZoom() ?? zoomBucket;

    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;
    for (const p of pin.photos) {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    }
    const isTightSpot = Math.max(maxLat - minLat, maxLng - minLng) < 0.0005;

    if (!isTightSpot && pin.cityKey) {
      const city = cityByKey.get(pin.cityKey);
      if (city && (pin.photos.length === city.photos.length || city.photos.length === 1)) {
        selectCityGroup(city);
        return;
      }
    }

    if (!isTightSpot && pin.photos.length > 1 && curZ < 11.5) {
      // Multi-spot overview cluster: zoom in to separate spots; if single city subset, focus its photos
      flyToPhotos(pin.photos, 11.5);
      if (pin.cityKey) {
        setSelection({ kind: "city", cityKey: pin.cityKey });
      } else {
        setSelection({ kind: "pin", photoIds: pin.photos.map((p) => p.id) });
      }
      return;
    }

    setSelection({ kind: "pin", photoIds: pin.photos.map((p) => p.id) });
    flyToPhotos(pin.photos, 12.5);
  };

  // Initialize MapLibre GL with Chinese-compliant cartographic style
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    let disposed = false;

    maplibregl.setWorkerUrl("/maplibre-gl-worker.js");

    const focusTarget = focusPhotoId > 0 ? geoPhotos.find((p) => p.id === focusPhotoId) : null;
    const initCenter: [number, number] =
      qLng !== null && qLat !== null
        ? [Number(qLng), Number(qLat)]
        : focusTarget
        ? [focusTarget.lng, focusTarget.lat]
        : [52, 30];

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {},
        layers: [
          {
            id: "bg",
            type: "background",
            paint: { "background-color": theme === "dark" ? "#0d0f14" : "#f1f5f9" },
          },
        ],
      },
      center: initCenter,
      zoom: initialZoom,
      minZoom: 1.2,
      maxZoom: 16.5,
      attributionControl: false,
      renderWorldCopies: false,
    });

    styleKeyRef.current = `${theme}:${locale}`;
    loadCompliantMapStyle(theme, locale)
      .then((style) => {
        if (!disposed) map.setStyle(style);
      })
      .catch(() => {});

    map.on("click", () => {
      setSelection(null);
    });

    const syncZoom = () => {
      const rounded = Math.round(map.getZoom() * 2) / 2;
      setZoomBucket((prev) => (prev === rounded ? prev : rounded));
    };
    map.on("zoomend", syncZoom);

    const ro = new ResizeObserver(() => {
      map.resize();
    });
    ro.observe(mapContainerRef.current);

    mapRef.current = map;

    return () => {
      disposed = true;
      ro.disconnect();
      markersRef.current.forEach(({ marker }) => marker.remove());
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync compliant basemap style when Dark/Light theme or Zh/En locale toggles
  useEffect(() => {
    const nextKey = `${theme}:${locale}`;
    if (styleKeyRef.current === nextKey || !mapRef.current) return;
    styleKeyRef.current = nextKey;
    const map = mapRef.current;
    loadCompliantMapStyle(theme, locale)
      .then((style) => {
        if (mapRef.current === map) map.setStyle(style);
      })
      .catch(() => {});
  }, [locale, theme]);

  // Mount / sync custom minimalist photo markers
  // IMPORTANT: Never set `position` or `transform` on `wrap` — MapLibre owns `wrap`'s absolute position & translate3d!
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach(({ marker }) => marker.remove());
    markersRef.current.clear();

    mapPins.forEach((pin) => {
      const cover = pin.photos[0];
      const wrap = document.createElement("div");

      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("aria-label", pin.location);
      btn.style.cssText =
        "position:relative;display:block;width:40px;height:40px;padding:0;border-radius:4px;cursor:pointer;background:#14161d;transition:transform 200ms cubic-bezier(0.22,1,0.36,1),box-shadow 200ms ease;";

      const img = document.createElement("img");
      img.src = optImg(cover.url, 128, 75);
      img.decoding = "async";
      img.alt = "";
      img.style.cssText =
        "width:100%;height:100%;object-fit:cover;border-radius:3px;display:block;pointer-events:none;";
      btn.appendChild(img);

      if (pin.photos.length > 1) {
        const badge = document.createElement("span");
        badge.textContent = String(pin.photos.length);
        badge.style.cssText =
          "position:absolute;top:-6px;right:-6px;min-width:17px;height:17px;padding:0 4px;border-radius:999px;font-size:10px;font-weight:600;line-height:17px;text-align:center;background:#f4f5f7;color:#0a0b0e;box-shadow:0 2px 6px rgba(0,0,0,0.4);pointer-events:none;";
        btn.appendChild(badge);
      }

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        handlePinClick(pin);
      });

      wrap.appendChild(btn);

      const marker = new maplibregl.Marker({ element: wrap, anchor: "center" })
        .setLngLat([pin.lng, pin.lat])
        .addTo(map);

      markersRef.current.set(pin.id, {
        marker,
        wrap,
        btn,
        photoIds: pin.photos.map((p) => p.id),
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapPins]);

  // Highlight active marker ring on inner `btn` (never overwriting `wrap.style.transform`!)
  useEffect(() => {
    const isDark = theme === "dark";
    markersRef.current.forEach(({ wrap, btn, photoIds }) => {
      const active =
        activePhotoIdSet.size > 0 && photoIds.some((id) => activePhotoIdSet.has(id));
      wrap.style.zIndex = active ? "20" : "1";
      btn.style.transform = active ? "scale(1.18)" : "scale(1)";
      btn.style.boxShadow = active
        ? isDark
          ? "0 0 0 2px #f4f5f7, 0 10px 24px rgba(0,0,0,0.65)"
          : "0 0 0 2px #111827, 0 10px 24px rgba(15,23,42,0.28)"
        : isDark
        ? "0 0 0 1.5px rgba(255,255,255,0.45), 0 6px 16px rgba(0,0,0,0.55)"
        : "0 0 0 1.5px rgba(255,255,255,0.95), 0 6px 16px rgba(15,23,42,0.2)";
    });
  }, [activePhotoIdSet, mapPins, theme]);

  const resetWorldView = () => {
    setSelection(null);
    mapRef.current?.flyTo({
      center: [52, 30],
      zoom: 1.65,
      duration: 850,
      essential: true,
    });
  };

  const openPhotoLightbox = (target: Photo, list: Photo[]) => {
    setLightboxList(list);
    setLightboxIdx(Math.max(0, list.findIndex((p) => p.id === target.id)));
  };

  return (
    <div className="min-h-dvh flex flex-col">
      <SiteHeader
        photographerName={settings.photographerName}
        photographerNameEn={settings.photographerNameEn}
      />

      {/* Aligned Split Map Stage: Map Canvas + Flush Frosted Glass Panel */}
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 pt-2 sm:px-9 sm:pt-3">
        <div className="surface-card flex h-[80dvh] sm:h-[78dvh] min-h-[500px] flex-col lg:flex-row overflow-hidden rounded-lg">
          <div className="relative flex-1 min-h-[42dvh] lg:min-h-0 bg-[var(--bg)]">
            <div ref={mapContainerRef} className="h-full w-full" />

            {/* Minimalist Map Zoom / Reset Control Strip */}
            <div className="surface-card absolute bottom-3 left-3 sm:bottom-4 sm:left-4 z-10 flex flex-col overflow-hidden rounded-md">
              <button
                type="button"
                onClick={() => mapRef.current?.zoomIn({ duration: 240 })}
                aria-label="放大地图"
                className="flex h-8 w-8 items-center justify-center text-[var(--fg-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg)] transition cursor-pointer"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => mapRef.current?.zoomOut({ duration: 240 })}
                aria-label="缩小地图"
                className="flex h-8 w-8 items-center justify-center border-t border-[var(--border)] text-[var(--fg-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg)] transition cursor-pointer"
              >
                <Minus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={resetWorldView}
                aria-label="全球视角"
                title={locale === "en" ? "World View" : "全球视角"}
                className="flex h-8 w-8 items-center justify-center border-t border-[var(--border)] text-[var(--fg-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg)] transition cursor-pointer"
              >
                <Globe2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Flush Frosted Glass Side Panel */}
          <aside className="flex w-full lg:w-92 max-h-[38dvh] lg:max-h-none shrink-0 flex-col border-t lg:border-t-0 lg:border-l border-[var(--glass-border)] bg-[var(--glass-strong)] backdrop-blur-2xl backdrop-saturate-180">
            {activeDetail ? (
              <>
                <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3 sm:px-6 sm:py-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <button
                        type="button"
                        onClick={() => setSelection(null)}
                        className="inline-flex items-center gap-1 text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] transition cursor-pointer"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        <span>{locale === "en" ? "All Cities" : "全部地点"}</span>
                      </button>
                      {activeDetail.parentCity && (
                        <>
                          <span className="text-xs text-[var(--fg-subtle)]">·</span>
                          <button
                            type="button"
                            onClick={() => selectCityGroup(activeDetail.parentCity!)}
                            className="truncate text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] transition cursor-pointer"
                          >
                            {pick(
                              activeDetail.parentCity.location,
                              activeDetail.parentCity.locationEn
                            )}{" "}
                            ({activeDetail.parentCity.photos.length})
                          </button>
                        </>
                      )}
                    </div>
                    <h2 className="truncate text-base font-semibold text-[var(--fg)]">
                      {pick(activeDetail.location, activeDetail.locationEn)}
                    </h2>
                    <div className="inline-flex items-center gap-1 text-xs text-[var(--fg-subtle)]">
                      <Compass className="h-3 w-3" />
                      <span>
                        {formatCoord(
                          activeDetail.lat,
                          activeDetail.lng,
                          activeDetail.detailedCoord
                        )}
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-[var(--fg-muted)]">
                    {activeDetail.photos.length} {locale === "en" ? "photos" : "幅"}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-3.5 sm:px-6 sm:py-5 space-y-4 sm:space-y-5">
                  {(() => {
                    const { cards: detailCards, lightboxPhotos: detailLbPhotos } =
                      collapsePhotoListForDisplay(activeDetail.photos, {
                        forceExpandAll: activeDetail.detailedCoord,
                        alwaysStack: !activeDetail.detailedCoord,
                      });
                    return detailCards.map((card) => {
                      const { photo, groupTotal, groupIndex, isStackedCover } = card;
                      const pTitle =
                        isStackedCover || groupTotal <= 1
                          ? pick(photo.title, photo.titleEn)
                          : pick(
                              formatNumberedTitle(photo.title, { index: groupIndex, total: groupTotal }),
                              formatNumberedTitle(photo.titleEn, { index: groupIndex, total: groupTotal })
                            );
                      const pSpot = pick(photo.location, photo.locationEn);
                      const cityTitle = pick(activeDetail.location, activeDetail.locationEn);
                      return (
                        <figure
                          key={photo.id}
                          onClick={() => openPhotoLightbox(photo, detailLbPhotos)}
                          className="group cursor-pointer space-y-2"
                        >
                          <div className="relative">
                            <GalleryImage
                              photoId={photo.id}
                              src={photo.url}
                              alt={pTitle}
                              ambient={photo.ambient}
                              blurData={photo.blurData}
                              aspectRatio={`${photo.width || 1600} / ${photo.height || 1068}`}
                              groupBadge={
                                groupTotal > 1
                                  ? isStackedCover
                                    ? groupTotal
                                    : `${groupIndex}/${groupTotal}`
                                  : undefined
                              }
                              className="w-full"
                            />
                          </div>
                          <figcaption className="flex items-center justify-between gap-2 text-xs">
                            <div className="min-w-0 truncate">
                              <span className="font-medium text-[var(--fg)]">{pTitle}</span>
                              {pSpot && pSpot !== cityTitle && (
                                <span className="ml-1.5 text-[var(--fg-subtle)]">· {pSpot}</span>
                              )}
                            </div>
                            <span className="inline-flex items-center gap-1 shrink-0 text-[var(--fg-muted)]">
                              <Aperture className="h-3 w-3 opacity-70" />
                              {[photo.focalMm ? `${photo.focalMm}mm` : "", photo.aperture]
                                .filter(Boolean)
                                .join(" ")}
                            </span>
                          </figcaption>
                        </figure>
                      );
                    });
                  })()}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3 sm:px-6 sm:py-4 text-sm">
                  <span className="font-semibold text-[var(--fg)]">
                    {locale === "en"
                      ? `${cityGroups.length} Locations`
                      : `${cityGroups.length} 处拍摄地`}
                  </span>
                  <span className="text-xs text-[var(--fg-muted)]">
                    {locale === "en" ? `${geoPhotos.length} Photos` : `共 ${geoPhotos.length} 幅`}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)]">
                  {cityGroups.map((city) => {
                    const cover = city.photos[0];
                    return (
                      <button
                        key={city.key}
                        type="button"
                        onClick={() => selectCityGroup(city)}
                        className="group flex w-full items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-3.5 text-left hover:bg-[var(--bg-subtle)] transition cursor-pointer"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="photo-frame h-10 w-14 shrink-0 overflow-hidden rounded-xs">
                            <img
                              src={optImg(cover.url, 128, 75)}
                              loading="lazy"
                              decoding="async"
                              alt=""
                              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-[var(--fg)]">
                              {pick(city.location, city.locationEn)}
                            </div>
                            <div className="inline-flex items-center gap-1 text-xs text-[var(--fg-subtle)]">
                              <MapPin className="h-3 w-3 opacity-70" />
                              <span>{formatCoord(city.lat, city.lng)}</span>
                            </div>
                          </div>
                        </div>
                        <span className="shrink-0 text-xs text-[var(--fg-muted)]">
                          {city.photos.length}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </aside>
        </div>
      </main>

      <SiteFooter settings={settings} />

      <Lightbox
        photos={lightboxList}
        activeIndex={lightboxIdx}
        collectionsMap={collectionsMap}
        photographerName={settings.photographerName}
        photographerNameEn={settings.photographerNameEn}
        onClose={() => setLightboxIdx(null)}
        onChangeIndex={setLightboxIdx}
      />
    </div>
  );
}
