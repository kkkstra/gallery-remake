"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ArrowUpRight } from "lucide-react";
import { ViewLink } from "./ViewLink";
import { loadCompliantMapStyle } from "@/lib/compliant-map-style";
import { optImg } from "@/lib/image-url";
import { usePreferences } from "./PreferencesProvider";

interface PhotoMiniMapProps {
  photoId: number;
  lat: number;
  lng: number;
  photoUrl?: string;
  onNavigate?: () => void;
}

export function PhotoMiniMap({ photoId, lat, lng, photoUrl, onNavigate }: PhotoMiniMapProps) {
  const { locale, theme } = usePreferences();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const styleKeyRef = useRef("");

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let disposed = false;

    maplibregl.setWorkerUrl("/maplibre-gl-worker.js");

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: { version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": theme === "dark" ? "#0d0f14" : "#f1f5f9" } }] },
      center: [lng, lat],
      zoom: 9.2,
      minZoom: 2,
      maxZoom: 15,
      scrollZoom: false,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    });

    styleKeyRef.current = `${theme}:${locale}`;
    loadCompliantMapStyle(theme, locale)
      .then((style) => {
        if (!disposed) map.setStyle(style);
      })
      .catch(() => {});

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

  // Sync compliant theme & locale style
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

  // Sync center & pin when switching photos in Lightbox
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    map.jumpTo({ center: [lng, lat], zoom: 9.2 });

    markerRef.current?.remove();
    const wrap = document.createElement("div");
    const pin = document.createElement("div");
    if (photoUrl) {
      pin.style.cssText =
        "width:30px;height:30px;border-radius:4px;overflow:hidden;background:#14161d;box-shadow:0 0 0 2px #f4f5f7,0 6px 16px rgba(0,0,0,0.55);";
      const img = document.createElement("img");
      img.src = optImg(photoUrl, 96, 75);
      img.decoding = "async";
      img.alt = "";
      img.style.cssText = "width:100%;height:100%;object-fit:cover;display:block;";
      pin.appendChild(img);
    } else {
      pin.style.cssText =
        "width:12px;height:12px;border-radius:999px;background:#f4f5f7;box-shadow:0 0 0 3px rgba(244,245,247,0.28),0 2px 8px rgba(0,0,0,0.5);";
    }
    wrap.appendChild(pin);

    markerRef.current = new maplibregl.Marker({ element: wrap, anchor: "center" })
      .setLngLat([lng, lat])
      .addTo(map);
  }, [lat, lng, photoUrl]);

  return (
    <div className="photo-frame relative h-36 w-full overflow-hidden rounded-md bg-[var(--bg-subtle)]">
      <div ref={containerRef} className="h-full w-full" />
      <ViewLink
        href={`/map?focus=${photoId}`}
        onClick={onNavigate}
        className="absolute bottom-2 right-2 z-10 inline-flex items-center gap-1 rounded bg-black/55 px-2 py-0.5 text-[11px] text-white/90 backdrop-blur-md hover:bg-black/75 transition"
      >
        <span>{locale === "en" ? "Open Map" : "地图查看"}</span>
        <ArrowUpRight className="h-3 w-3" />
      </ViewLink>
    </div>
  );
}
