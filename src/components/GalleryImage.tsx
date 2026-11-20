"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Maximize2 } from "lucide-react";
import { optImg, optSrcSet } from "@/lib/image-url";
import { usePreferences } from "./PreferencesProvider";

const RESPONSIVE_WIDTHS = [384, 640, 828, 1080, 1200, 1920] as const;

interface GalleryImageProps {
  photoId?: number;
  src: string;
  alt: string;
  ambient?: string;
  blurData?: string;
  aspectRatio?: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
  imgClassName?: string;
  style?: CSSProperties;
  showLoupe?: boolean;
}

export function GalleryImage({
  photoId,
  src,
  alt,
  ambient = "#181a20",
  blurData,
  aspectRatio,
  sizes = "(max-width: 640px) 96vw, (max-width: 1024px) 50vw, 33vw",
  priority = false,
  className = "",
  imgClassName = "",
  style,
  showLoupe = true,
}: GalleryImageProps) {
  const { copyrightGuard } = usePreferences();
  const imgRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0) {
      setLoaded(true);
      setSettled(true);
    } else {
      setLoaded(false);
      setSettled(false);
    }
  }, [src]);

  useEffect(() => {
    if (!loaded || settled) return;
    const t = setTimeout(() => setSettled(true), 420);
    return () => clearTimeout(t);
  }, [loaded, settled]);

  return (
    <div
      style={{
        aspectRatio,
        ...style,
      }}
      className={`group/img relative ${className}`}
    >
      <div
        style={{ backgroundColor: settled ? "transparent" : `${ambient}44` }}
        onContextMenu={(e) => {
          if (copyrightGuard) e.preventDefault();
        }}
        className="photo-frame relative h-full w-full overflow-hidden"
      >
        {/* 24px Color LQIP Blur-Up Underlay — unmounted once settled to free GPU filter layers */}
        {blurData && !settled && (
          <div
            aria-hidden="true"
            style={{ backgroundImage: `url(${blurData})` }}
            className={`pointer-events-none absolute inset-0 bg-cover bg-center blur-md scale-105 transition-opacity duration-350 ${
              loaded ? "opacity-0" : "opacity-100"
            }`}
          />
        )}

        <img
          ref={imgRef}
          data-morph-photo-id={photoId}
          src={optImg(src, 1080, 85)}
          srcSet={optSrcSet(src, RESPONSIVE_WIDTHS, 85)}
          sizes={sizes}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : undefined}
          alt={alt}
          draggable={!copyrightGuard}
          onLoad={() => setLoaded(true)}
          className={`relative block w-full h-full object-cover transition-[transform,opacity] duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            loaded ? "opacity-100" : "opacity-0"
          } group-hover:scale-[1.03] group-hover/img:scale-[1.03] ${imgClassName}`}
        />

        {/* Subtle top-down optical sheen on hover */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.03] to-white/[0.08] opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-hover/img:opacity-100"
        />

        {/* Restrained tactile corner loupe badge on hover (no per-card backdrop-filter) */}
        {showLoupe && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/62 text-white/90 opacity-0 scale-90 transition-[opacity,transform] duration-250 ease-out group-hover:opacity-100 group-hover:scale-100 group-hover/img:opacity-100 group-hover/img:scale-100"
          >
            <Maximize2 className="h-3.5 w-3.5 stroke-[1.6]" />
          </span>
        )}
      </div>
    </div>
  );
}
