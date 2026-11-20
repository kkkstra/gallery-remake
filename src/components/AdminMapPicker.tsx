"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Crosshair, Minus, Plus, Search, X } from "lucide-react";
import { loadCompliantMapStyle } from "@/lib/compliant-map-style";
import { usePreferences } from "./PreferencesProvider";

interface AdminMapPickerProps {
  lat: number | string | null | undefined;
  lng: number | string | null | undefined;
  onChange: (next: {
    lat: number | null;
    lng: number | null;
    location?: string;
    locationEn?: string;
  }) => void;
  heightClass?: string;
}

function toNum(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function AdminMapPicker({
  lat,
  lng,
  onChange,
  heightClass = "h-52 sm:h-56",
}: AdminMapPickerProps) {
  const { theme } = usePreferences();
  const numLat = toNum(lat);
  const numLng = toNum(lng);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let disposed = false;

    maplibregl.setWorkerUrl("/maplibre-gl-worker.js");

    const hasInit = numLat !== null && numLng !== null;
    const map = new maplibregl.Map({
      container: containerRef.current,
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
      center: hasInit ? [numLng, numLat] : [108.5, 34.2],
      zoom: hasInit ? 11.5 : 3.2,
      minZoom: 1.2,
      maxZoom: 17,
      attributionControl: false,
      renderWorldCopies: false,
    });

    loadCompliantMapStyle(theme, "zh")
      .then((style) => {
        if (!disposed) map.setStyle(style);
      })
      .catch(() => {});

    map.getCanvas().style.cursor = "crosshair";

    map.on("click", (e) => {
      const pickedLat = Number(e.lngLat.lat.toFixed(5));
      const pickedLng = Number(e.lngLat.lng.toFixed(5));
      onChangeRef.current({ lat: pickedLat, lng: pickedLng });
    });

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);

    mapRef.current = map;

    return () => {
      disposed = true;
      ro.disconnect();
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    loadCompliantMapStyle(theme, "zh")
      .then((style) => {
        if (mapRef.current === map) map.setStyle(style);
      })
      .catch(() => {});
  }, [theme]);

  // Sync draggable pin marker whenever [numLat, numLng] changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (numLat === null || numLng === null) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    if (!markerRef.current) {
      // Never set inline position/transform on `wrap` — MapLibre manages `wrap` transform!
      const wrap = document.createElement("div");
      const pin = document.createElement("div");
      pin.style.cssText =
        "width:20px;height:20px;border-radius:999px;background:#10b981;border:2.5px solid #ffffff;box-shadow:0 3px 12px rgba(0,0,0,0.55);cursor:grab;";
      wrap.appendChild(pin);

      const m = new maplibregl.Marker({ element: wrap, anchor: "center", draggable: true })
        .setLngLat([numLng, numLat])
        .addTo(map);

      m.on("dragend", () => {
        const pos = m.getLngLat();
        onChangeRef.current({
          lat: Number(pos.lat.toFixed(5)),
          lng: Number(pos.lng.toFixed(5)),
        });
      });

      markerRef.current = m;
    } else {
      markerRef.current.setLngLat([numLng, numLat]);
    }
  }, [numLat, numLng]);

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    try {
      const r = await fetch(`/api/admin/geocode?q=${encodeURIComponent(q)}`);
      if (r.ok) {
        const g = await r.json();
        onChangeRef.current({
          lat: g.lat,
          lng: g.lng,
          location: g.location,
          locationEn: g.locationEn,
        });
        mapRef.current?.flyTo({ center: [g.lng, g.lat], zoom: 11.5, duration: 680 });
      }
    } catch {
      // ignore
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--fg-subtle)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSearch();
              }
            }}
            placeholder="搜索城市/景区快速跳转，再点按地图精确落点…"
            className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] pl-8 pr-2.5 py-1.5 text-base sm:text-xs text-[var(--fg)] placeholder:text-[var(--fg-subtle)] outline-none focus:border-[var(--fg-muted)]"
          />
        </div>
        <button
          type="button"
          disabled={searching}
          onClick={handleSearch}
          className="shrink-0 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1.5 text-xs text-[var(--fg)] hover:bg-[var(--bg-subtle)] cursor-pointer"
        >
          {searching ? "定位中" : "跳转"}
        </button>
      </div>

      <div className={`relative w-full overflow-hidden rounded-lg border border-[var(--border)] ${heightClass}`}>
        <div ref={containerRef} className="h-full w-full" />

        {/* Zoom Controls */}
        <div className="surface-card absolute bottom-2 left-2 z-10 flex flex-col overflow-hidden rounded">
          <button
            type="button"
            onClick={() => mapRef.current?.zoomIn({ duration: 200 })}
            className="flex h-7 w-7 items-center justify-center text-[var(--fg-muted)] hover:text-[var(--fg)] cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => mapRef.current?.zoomOut({ duration: 200 })}
            className="flex h-7 w-7 items-center justify-center border-t border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)] cursor-pointer"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Live Coordinate Readout / Clear */}
        <div className="surface-card absolute bottom-2 right-2 z-10 flex items-center gap-1.5 rounded px-2 py-1 text-[11px] text-[var(--fg)]">
          <Crosshair className="h-3 w-3 text-emerald-500 shrink-0" />
          {numLat !== null && numLng !== null ? (
            <>
              <span>
                {numLat.toFixed(4)}, {numLng.toFixed(4)}
              </span>
              <button
                type="button"
                onClick={() => onChangeRef.current({ lat: null, lng: null })}
                title="清除所选坐标"
                className="text-[var(--fg-muted)] hover:text-red-400 cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            </>
          ) : (
            <span className="text-[var(--fg-muted)]">点击地图选点（支持拖拽微调）</span>
          )}
        </div>
      </div>
    </div>
  );
}
