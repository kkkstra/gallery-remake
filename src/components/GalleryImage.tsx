"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Maximize2 } from "lucide-react";
import { usePreferences } from "./PreferencesProvider";

interface GalleryImageProps {
  photoId?: number;
  src: string;
  alt: string;
  ambient?: string;
  blurData?: string;
  aspectRatio?: string;
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
  className = "",
  imgClassName = "",
  style,
  showLoupe = true,
}: GalleryImageProps) {
  const { copyrightGuard } = usePreferences();
  const imgRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0) {
      setLoaded(true);
    } else {
      setLoaded(false);
    }
  }, [src]);

  return (
    <div
      style={{
        aspectRatio,
        ...style,
      }}
      className={`group/img relative isolate ${className}`}
    >
      {/* Dynamic Spatial Ambient Color Halo on Hover */}
      {loaded && (
        <img
          src={src}
          alt=""
          aria-hidden="true"
          decoding="async"
          className="ambient-photo-halo pointer-events-none absolute -inset-2 -z-10 h-[calc(100%+16px)] w-[calc(100%+16px)] max-w-none rounded-xl object-cover"
        />
      )}

      <div
        style={{ backgroundColor: loaded ? "transparent" : `${ambient}44` }}
        onContextMenu={(e) => {
          if (copyrightGuard) e.preventDefault();
        }}
        className="photo-frame relative h-full w-full overflow-hidden"
      >
        {/* True 24px Color LQIP Blur-Up Underlay */}
        {blurData && (
          <div
            aria-hidden="true"
            style={{ backgroundImage: `url(${blurData})` }}
            className={`pointer-events-none absolute inset-0 bg-cover bg-center blur-lg scale-110 transition-opacity duration-500 ${
              loaded ? "opacity-0" : "opacity-100"
            }`}
          />
        )}

        <img
          ref={imgRef}
          data-morph-photo-id={photoId}
          src={src}
          alt={alt}
          draggable={!copyrightGuard}
          onLoad={() => setLoaded(true)}
          className={`relative block w-full h-full object-cover transition-[scale,transform,opacity,filter] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            loaded ? "opacity-100 blur-0 scale-100" : "opacity-0 blur-xs scale-[1.015]"
          } group-hover:scale-[1.035] group-hover/img:scale-[1.035] ${imgClassName}`}
        />

        {/* Subtle top-down optical sheen on hover */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.03] to-white/[0.08] opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-hover/img:opacity-100"
        />

        {/* Restrained tactile corner loupe badge on hover */}
        {showLoupe && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white/90 opacity-0 scale-90 backdrop-blur-md transition-[opacity,scale,transform] duration-300 ease-out group-hover:opacity-100 group-hover:scale-100 group-hover/img:opacity-100 group-hover/img:scale-100"
          >
            <Maximize2 className="h-3.5 w-3.5 stroke-[1.6]" />
          </span>
        )}
      </div>
    </div>
  );
}
