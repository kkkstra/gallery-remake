"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Aperture, ArrowLeft, Compass, Globe2, MapPin, Minus, Plus } from "lucide-react";
import type { Photo } from "@/lib/db/schema";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { Lightbox } from "./Lightbox";
import { GalleryImage } from "./GalleryImage";
import { loadCompliantMapStyle } from "@/lib/compliant-map-style";
import { usePreferences } from "./PreferencesProvider";

interface MapClientProps {
  photos: Photo[];
  collectionsMap: Record<number, { slug: string; title: string; titleEn: string }[]>;
  settings: Record<string, string>;
}

interface PlaceGroup {
  id: string;
  lat: number;
  lng: number;
  location: string;
  locationEn: string;
  photos: (Photo & { lat: number; lng: number })[];
}

function formatCoord(lat: number, lng: number, detailed = false): string {
  const digits = detailed ? 4 : 2;
  return `${Math.abs(lat).toFixed(digits)}°${lat >= 0 ? "N" : "S"}, ${Math.abs(lng).toFixed(digits)}°${lng >= 0 ? "E" : "W"}`;
}

function getClusterRadiusDeg(zoom: number): number {
  if (zoom >= 11) return 0.00012; // ~13m: individual street shooting spots
  if (zoom <= 2.5) return 0.45; // ~48km: clean regional/metro clusters at world view
  return 0.45 / Math.pow(2, zoom - 2.5);
}

export function MapClient({ photos, collectionsMap, settings }: MapClientProps) {
  const { locale, theme, pick } = usePreferences();
  const searchParams = useSearchParams();
  const focusPhotoId = Number(searchParams.get("focus") || 0);
  const qLat = searchParams.get("lat");
  const qLng = searchParams.get("lng");
  const qZoom = searchParams.get("z");

  const geoPhotos = useMemo(
    () => photos.filter((p): p is Photo & { lat: number; lng: number } => p.lat !== null && p.lng !== null),
    [photos]
  );

  const initialZoom = qZoom !== null ? Number(qZoom) : focusPhotoId > 0 ? 11.5 : 1.65;
  const [zoomBucket, setZoomBucket] = useState<number>(() => Math.round(initialZoom * 2) / 2);

  // Dynamically uncluster from city -> district -> street-level spots as map zooms in
  const places = useMemo<PlaceGroup[]>(() => {
    if (zoomBucket >= 12) {
      // Street-level: every photo gets its own exact pin; subtly fan out identical tripod coordinates
      const coordCounts = new Map<string, number>();
      const coordIndex = new Map<string, number>();
      for (const p of geoPhotos) {
        const k = `${p.lat.toFixed(4)}_${p.lng.toFixed(4)}`;
        coordCounts.set(k, (coordCounts.get(k) || 0) + 1);
      }
      return geoPhotos.map((p) => {
        const k = `${p.lat.toFixed(4)}_${p.lng.toFixed(4)}`;
        const total = coordCounts.get(k) || 1;
        const idx = coordIndex.get(k) || 0;
        coordIndex.set(k, idx + 1);

        let lat = p.lat;
        let lng = p.lng;
        if (total > 1) {
          const angle = (2 * Math.PI * idx) / total;
          const offset = 0.00028 / Math.pow(1.6, Math.max(0, zoomBucket - 12));
          lat += Math.sin(angle) * offset;
          lng += Math.cos(angle) * offset;
        }
        return {
          id: `p_${p.id}`,
          lat,
          lng,
          location: p.location || p.title,
          locationEn: p.locationEn || p.titleEn || p.location || p.title,
          photos: [p],
        };
      });
    }

    const radius = getClusterRadiusDeg(zoomBucket);
    const groups: PlaceGroup[] = [];

    for (const p of geoPhotos) {
      const match = groups.find((g) => Math.hypot(g.lat - p.lat, g.lng - p.lng) < radius);
      if (match) {
        const n = match.photos.length;
        match.lat = (match.lat * n + p.lat) / (n + 1);
        match.lng = (match.lng * n + p.lng) / (n + 1);
        match.photos.push(p);
      } else {
        groups.push({
          id: `g_${p.id}`,
          lat: p.lat,
          lng: p.lng,
          location: p.location || "未知地点",
          locationEn: p.locationEn || p.location || "Unknown",
          photos: [p],
        });
      }
    }
    return groups.sort((a, b) => b.photos.length - a.photos.length);
  }, [geoPhotos, zoomBucket]);

  const [selectedPhotoId, setSelectedPhotoId] = useState<number | null>(
    focusPhotoId > 0 ? focusPhotoId : null
  );
  const [lightboxList, setLightboxList] = useState<Photo[]>(geoPhotos);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<
    Map<string, { marker: maplibregl.Marker; wrap: HTMLDivElement; btn: HTMLButtonElement }>
  >(new Map());
  const styleKeyRef = useRef("");

  const selectedPlace = useMemo(() => {
    if (selectedPhotoId === null) return null;
    return places.find((g) => g.photos.some((p) => p.id === selectedPhotoId)) ?? null;
  }, [places, selectedPhotoId]);

  const zoomToGroup = (group: PlaceGroup) => {
    setSelectedPhotoId(group.photos[0]?.id ?? null);
    const map = mapRef.current;
    if (!map) return;

    const curZ = map.getZoom();
    if (group.photos.length > 1) {
      let minLat = Infinity;
      let maxLat = -Infinity;
      let minLng = Infinity;
      let maxLng = -Infinity;
      for (const p of group.photos) {
        if (p.lat < minLat) minLat = p.lat;
        if (p.lat > maxLat) maxLat = p.lat;
        if (p.lng < minLng) minLng = p.lng;
        if (p.lng > maxLng) maxLng = p.lng;
      }
      const span = Math.max(maxLat - minLat, maxLng - minLng);
      // Compute zoom needed so this cluster separates into sub-clusters / exact spots
      const neededZoom =
        span < 0.0003
          ? 12.5
          : Math.min(13, Math.max(curZ + 2.5, Math.log2(0.45 / (span * 0.65)) + 2.5));

      map.flyTo({
        center: [group.lng, group.lat],
        zoom: neededZoom,
        duration: 820,
        essential: true,
      });
    } else {
      map.flyTo({
        center: [group.lng, group.lat],
        zoom: Math.max(curZ, 11.5),
        duration: 820,
        essential: true,
      });
    }
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
      setSelectedPhotoId(null);
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

    places.forEach((group) => {
      const cover = group.photos[0];
      const wrap = document.createElement("div");

      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("aria-label", group.location);
      btn.style.cssText =
        "position:relative;display:block;width:40px;height:40px;padding:0;border-radius:4px;cursor:pointer;background:#14161d;transition:transform 200ms cubic-bezier(0.22,1,0.36,1),box-shadow 200ms ease;";

      const img = document.createElement("img");
      img.src = cover.url;
      img.alt = "";
      img.style.cssText =
        "width:100%;height:100%;object-fit:cover;border-radius:3px;display:block;pointer-events:none;";
      btn.appendChild(img);

      if (group.photos.length > 1) {
        const badge = document.createElement("span");
        badge.textContent = String(group.photos.length);
        badge.style.cssText =
          "position:absolute;top:-6px;right:-6px;min-width:17px;height:17px;padding:0 4px;border-radius:999px;font-size:10px;font-weight:600;line-height:17px;text-align:center;background:#f4f5f7;color:#0a0b0e;box-shadow:0 2px 6px rgba(0,0,0,0.4);pointer-events:none;";
        btn.appendChild(badge);
      }

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        zoomToGroup(group);
      });

      wrap.appendChild(btn);

      const marker = new maplibregl.Marker({ element: wrap, anchor: "center" })
        .setLngLat([group.lng, group.lat])
        .addTo(map);

      markersRef.current.set(group.id, { marker, wrap, btn });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places]);

  // Highlight active marker ring on inner `btn` (never overwriting `wrap.style.transform`!)
  useEffect(() => {
    const isDark = theme === "dark";
    const activeGroupId = selectedPlace?.id ?? null;
    markersRef.current.forEach(({ wrap, btn }, id) => {
      const active = id === activeGroupId;
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
  }, [places, selectedPlace, theme]);

  const resetWorldView = () => {
    setSelectedPhotoId(null);
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

  const isDetailedZoom = zoomBucket >= 8;

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
            {selectedPlace ? (
              <>
                <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3 sm:px-6 sm:py-4">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={resetWorldView}
                      className="inline-flex items-center gap-1 text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] transition cursor-pointer mb-1"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      <span>{locale === "en" ? "All Locations" : "全部地点"}</span>
                    </button>
                    <h2 className="truncate text-base font-semibold text-[var(--fg)]">
                      {pick(selectedPlace.location, selectedPlace.locationEn)}
                    </h2>
                    <div className="inline-flex items-center gap-1 text-xs text-[var(--fg-subtle)]">
                      <Compass className="h-3 w-3" />
                      <span>
                        {formatCoord(
                          selectedPlace.photos[0]?.lat ?? selectedPlace.lat,
                          selectedPlace.photos[0]?.lng ?? selectedPlace.lng,
                          true
                        )}
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-[var(--fg-muted)]">
                    {selectedPlace.photos.length} {locale === "en" ? "photos" : "幅"}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-3.5 sm:px-6 sm:py-5 space-y-4 sm:space-y-5">
                  {selectedPlace.photos.map((photo) => {
                    const pTitle = pick(photo.title, photo.titleEn);
                    return (
                      <figure
                        key={photo.id}
                        onClick={() => openPhotoLightbox(photo, selectedPlace.photos)}
                        className="group cursor-pointer space-y-2"
                      >
                        <GalleryImage
                          photoId={photo.id}
                          src={photo.url}
                          alt={pTitle}
                          ambient={photo.ambient}
                          blurData={photo.blurData}
                          aspectRatio={`${photo.width || 1600} / ${photo.height || 1068}`}
                          className="w-full"
                        />
                        <figcaption className="flex items-center justify-between gap-2 text-xs">
                          <span className="truncate font-medium text-[var(--fg)]">{pTitle}</span>
                          <span className="inline-flex items-center gap-1 shrink-0 text-[var(--fg-muted)]">
                            <Aperture className="h-3 w-3 opacity-70" />
                            {[photo.focalMm ? `${photo.focalMm}mm` : "", photo.aperture]
                              .filter(Boolean)
                              .join(" ")}
                          </span>
                        </figcaption>
                      </figure>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3 sm:px-6 sm:py-4 text-sm">
                  <span className="font-semibold text-[var(--fg)]">
                    {locale === "en"
                      ? `${places.length} ${isDetailedZoom ? "Spots" : "Locations"}`
                      : `${places.length} 处${isDetailedZoom ? "机位" : "拍摄地"}`}
                  </span>
                  <span className="text-xs text-[var(--fg-muted)]">
                    {locale === "en" ? `${geoPhotos.length} Photos` : `共 ${geoPhotos.length} 幅`}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)]">
                  {places.map((group) => {
                    const cover = group.photos[0];
                    const placeTitle =
                      isDetailedZoom && group.photos.length === 1
                        ? `${pick(cover.title, cover.titleEn)} · ${pick(group.location, group.locationEn)}`
                        : pick(group.location, group.locationEn);
                    return (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => zoomToGroup(group)}
                        className="group flex w-full items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-3.5 text-left hover:bg-[var(--bg-subtle)] transition cursor-pointer"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="photo-frame h-10 w-14 shrink-0 overflow-hidden rounded-xs">
                            <img
                              src={cover.url}
                              alt=""
                              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-[var(--fg)]">
                              {placeTitle}
                            </div>
                            <div className="inline-flex items-center gap-1 text-xs text-[var(--fg-subtle)]">
                              <MapPin className="h-3 w-3 opacity-70" />
                              <span>{formatCoord(cover.lat, cover.lng, isDetailedZoom)}</span>
                            </div>
                          </div>
                        </div>
                        <span className="shrink-0 text-xs text-[var(--fg-muted)]">
                          {group.photos.length}
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
