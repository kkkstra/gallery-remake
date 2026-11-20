interface GearSvgProps {
  name: string;
  className?: string;
}

export function parseCameraLabel(full: string): { brand: string; model: string } {
  const trimmed = full.trim();
  if (!trimmed) return { brand: "", model: "" };

  const cleaned = trimmed
    .replace(/^NIKON CORPORATION\s+/i, "")
    .replace(/^OLYMPUS CORPORATION\s+/i, "");
  const lower = cleaned.toLowerCase();

  const parts = cleaned.split(/\s+/);
  if (parts.length > 1) {
    return { brand: parts[0], model: parts.slice(1).join(" ") };
  }

  // Infer brand when EXIF body string omits manufacturer prefix (e.g. DC-S5M2, ILCE-7RM5, X-T5)
  if (/^(dc-|dmc-|lumix)/i.test(lower)) return { brand: "LUMIX", model: cleaned };
  if (/^(ilce-|zv-|dsc-)/i.test(lower)) return { brand: "SONY", model: cleaned };
  if (/^(x-[a-z0-9]|x100|gfx)/i.test(lower)) return { brand: "FUJIFILM", model: cleaned };
  if (/^z[_\s-]?\d|^zf$/i.test(lower)) return { brand: "NIKON", model: cleaned };
  if (/^eos/i.test(lower)) return { brand: "CANON", model: cleaned };
  if (/^gr\b/i.test(lower)) return { brand: "RICOH", model: cleaned };

  return { brand: "", model: cleaned };
}

export function parseLensHeadline(
  lens: string,
  fallbackFocal?: number | null
): { spec: string; sub: string; sortFocal: number } {
  const raw = lens.trim();

  // 1. Focal range: Zoom first (e.g. 24-60/F2.8, 24-120mm f/4, XF16-55mmF2.8), then Prime (35mm, /55V, 1:1.4/35)
  const zoomMatch = raw.match(/(?:^|[^\d.])(\d{1,3})\s*-\s*(\d{2,4})\s*(?:mm)?(?=[\s/fF]|$)/i);
  const primeMmMatch = !zoomMatch ? raw.match(/(\d{1,4}(?:\.\d+)?)\s*mm/i) : null;
  const slashFocalMatch =
    !zoomMatch && !primeMmMatch
      ? raw.match(/(?:1:\d+(?:[.,]\d+)?|\b\d+(?:[.,]\d+)?)\/(\d{2,3})V?\b/i)
      : null;

  let focal = "";
  let sortFocal = fallbackFocal || 50;
  if (zoomMatch) {
    focal = `${zoomMatch[1]}-${zoomMatch[2]}mm`;
    sortFocal = Number(zoomMatch[1]);
  } else if (primeMmMatch) {
    focal = `${primeMmMatch[1]}mm`;
    sortFocal = Number(primeMmMatch[1]);
  } else if (slashFocalMatch) {
    focal = `${slashFocalMatch[1]}mm`;
    sortFocal = Number(slashFocalMatch[1]);
  } else if (fallbackFocal) {
    focal = `${fallbackFocal}mm`;
  }

  // 2. Aperture: variable zoom aperture first (f/3.5-5.6, /F4-7.1, F2.8-4), then constant (f/4, /F2.8, mmF2, 1:1.4, 2,5/55V)
  const varApMatch = raw.match(
    /(?:f\/?|\/f\s*|1:)(\d+(?:[.,]\d+)?\s*-\s*\d+(?:[.,]\d+)?)/i
  );
  const constApMatch =
    !varApMatch &&
    (raw.match(/(?:f\/|\/f\s*|1:)(\d+(?:[.,]\d+)?)/i) ||
      raw.match(/(?:mm|\s)f(\d+(?:[.,]\d+)?)\b/i) ||
      raw.match(/\b(\d+(?:[.,]\d+)?)\/\d{2,3}V?\b/));

  const apRaw = varApMatch ? varApMatch[1] : constApMatch ? constApMatch[1] : "";
  const ap = apRaw ? `f/${apRaw.replace(/\s+/g, "").replace(/,/g, ".")}` : "";

  const spec = [focal, ap].filter(Boolean).join(" ");
  return { spec: spec || raw, sub: raw, sortFocal };
}

export function CameraIllustration({ name, className = "h-16 w-auto" }: GearSvgProps) {
  const lower = name.toLowerCase();

  // 1. Leica M-Series Rangefinder
  if (lower.includes("m11") || lower.includes("m10") || lower.includes("m6") || (lower.includes("leica") && !lower.includes("q") && !lower.includes("sl"))) {
    return (
      <svg viewBox="0 0 120 74" fill="none" className={className} aria-hidden="true">
        <rect x="20" y="9" width="15" height="5" rx="1" fill="#a1a1aa" stroke="#52525b" strokeWidth="1" />
        <rect x="82" y="8" width="16" height="6" rx="1" fill="#d4d4d8" stroke="#52525b" strokeWidth="1" />
        <rect x="65" y="10" width="10" height="4" rx="0.8" fill="#71717a" />
        <rect x="10" y="14" width="100" height="52" rx="8" fill="#18181b" stroke="#3f3f46" strokeWidth="1.4" />
        <path d="M10 22 C10 17.5 13.5 14 18 14 H102 C106.5 14 110 17.5 110 22 V29 H10 V22 Z" fill="#d4d4d8" stroke="#71717a" strokeWidth="1" />
        <path d="M12 62 H108 C107 65 104.5 66 102 66 H18 C15.5 66 13 65 12 62 Z" fill="#a1a1aa" />
        <rect x="19" y="17.5" width="15" height="8" rx="1.2" fill="#0f172a" stroke="#52525b" strokeWidth="1" />
        <rect x="21" y="19" width="6" height="3" rx="0.5" fill="#38bdf8" fillOpacity="0.45" />
        <rect x="43" y="19" width="7" height="5.5" rx="0.8" fill="#e4e4e7" stroke="#71717a" strokeWidth="0.8" />
        <rect x="86" y="18.5" width="11" height="6.5" rx="1" fill="#0f172a" stroke="#52525b" strokeWidth="1" />
        <circle cx="91.5" cy="21.7" r="2" fill="#38bdf8" fillOpacity="0.4" />
        <circle cx="38" cy="36" r="4.2" fill="#dc2626" />
        <text x="38" y="37.8" textAnchor="middle" fill="#ffffff" fontSize="5" fontStyle="italic" fontWeight="700">L</text>
        <circle cx="43" cy="48" r="2.3" fill="#d4d4d8" stroke="#52525b" strokeWidth="0.8" />
        <circle cx="69" cy="45" r="18.5" fill="#d4d4d8" stroke="#52525b" strokeWidth="1.2" />
        <circle cx="69" cy="45" r="14.5" fill="#09090b" stroke="#3f3f46" strokeWidth="1" />
        <circle cx="69" cy="28.3" r="1.3" fill="#dc2626" />
        <rect x="58.5" y="38" width="21" height="14" rx="1" fill="#0f4c5c" stroke="#34d399" strokeWidth="0.6" strokeOpacity="0.6" />
      </svg>
    );
  }

  // 2. Leica Q3 / Q2 Fixed-Lens Compact
  if (lower.includes("q3") || lower.includes("q2") || lower.includes("leica q")) {
    return (
      <svg viewBox="0 0 120 74" fill="none" className={className} aria-hidden="true">
        <rect x="22" y="10" width="14" height="4" rx="1" fill="#3f3f46" />
        <rect x="84" y="9" width="14" height="5" rx="1" fill="#52525b" />
        <rect x="11" y="14" width="98" height="52" rx="7" fill="#18181b" stroke="#52525b" strokeWidth="1.4" />
        <path d="M11 21 C11 17 14 14 18 14 H102 C106 14 109 17 109 21 V27 H11 V21 Z" fill="#27272a" />
        <rect x="88" y="18.5" width="9" height="5" rx="1" fill="#09090b" stroke="#52525b" strokeWidth="0.9" />
        <circle cx="33" cy="25" r="4" fill="#dc2626" />
        <text x="33" y="26.8" textAnchor="middle" fill="#ffffff" fontSize="4.8" fontStyle="italic" fontWeight="700">L</text>
        <path d="M44 59 L40 66 H48 L50 61 Z" fill="#3f3f46" stroke="#71717a" strokeWidth="0.9" />
        <circle cx="65" cy="43" r="22" fill="#27272a" stroke="#71717a" strokeWidth="1.4" />
        <circle cx="65" cy="43" r="18.5" fill="#09090b" stroke="#52525b" strokeWidth="1" strokeDasharray="2.5 1.5" />
        <circle cx="65" cy="43" r="14" fill="#111827" stroke="#3f3f46" strokeWidth="1.2" />
        <ellipse cx="60" cy="38" rx="4.5" ry="2.2" transform="rotate(-28 60 38)" fill="#6ee7b7" fillOpacity="0.4" />
      </svg>
    );
  }

  // 3. Nikon Z Series (Z9 / Z8 / Z7 / Z6 / Z5 / Zf) — Angular Nikon prism, red grip slash, huge wide Z-mount
  if (lower.includes("nikon") || lower.includes("nikkor") || /\bz\s?[56789f]\b|\bz[35]0\b/i.test(lower)) {
    const isRetroZf = /\bz\s?f|\bz\s?fc/i.test(lower);
    return (
      <svg viewBox="0 0 120 74" fill="none" className={className} aria-hidden="true">
        {/* Iconic Angular Nikon Z Pentaprism */}
        <path d="M41 17 L48 5 H74 L81 17 Z" fill="#27272a" stroke="#71717a" strokeWidth="1.4" strokeLinejoin="round" />
        <text x="61" y="13.5" textAnchor="middle" fill="#f4f4f5" fontSize="4.5" fontWeight="700" letterSpacing="0.8">NIKON</text>
        {/* Top Dials */}
        <rect x="85" y="11" width="14" height="6" rx="1" fill={isRetroZf ? "#d4d4d8" : "#3f3f46"} stroke="#71717a" strokeWidth="1" />
        <rect x="16" y="12" width="13" height="5" rx="1" fill={isRetroZf ? "#d4d4d8" : "#3f3f46"} stroke="#71717a" strokeWidth="1" />
        {/* Chassis */}
        <rect x="11" y="17" width="98" height="49" rx="4.5" fill="#18181b" stroke="#52525b" strokeWidth="1.4" />
        {isRetroZf && (
          <path d="M11 21 C11 18.8 12.8 17 15 17 H105 C107.2 17 109 18.8 109 21 V25 H11 V21 Z" fill="#d4d4d8" />
        )}
        {/* Ergonomic Grip + Signature Nikon Crimson Slash */}
        {!isRetroZf && (
          <>
            <path d="M11 17 H30 L28 66 H15.5 C13 66 11 64 11 61.5 V17 Z" fill="#27272a" stroke="#52525b" strokeWidth="1.2" />
            <path d="M25 22 L28.5 22 L25.5 36 L22.5 34 Z" fill="#dc2626" />
          </>
        )}
        {/* Crisp White Nikon Z Emblem */}
        <text x="97" y="30" textAnchor="middle" fill="#f4f4f5" fontSize="8" fontWeight="700">Z</text>
        {/* Massive 55mm Throat Nikon Z-Mount + Full-Frame Sensor */}
        <circle cx="62" cy="43" r="21.5" fill="#d4d4d8" stroke="#52525b" strokeWidth="1.3" />
        <circle cx="62" cy="43" r="17.8" fill="#09090b" />
        <circle cx="43.2" cy="36" r="1.2" fill="#f4f4f5" />
        <rect x="51" y="35.5" width="22" height="15" rx="1" fill="#0f5156" stroke="#5eead4" strokeWidth="0.6" strokeOpacity="0.65" />
      </svg>
    );
  }

  // 4. Panasonic LUMIX S / G Series (S5 II, S1R, S9, G9 II) — Bold Lumix top deck, crimson REC / dial accent, L-Mount
  if (lower.includes("lumix") || lower.includes("panasonic") || /^(dc-|dmc-)/.test(lower)) {
    const isFlatS9 = lower.includes("s9") || lower.includes("gx") || lower.includes("gm");
    return (
      <svg viewBox="0 0 120 74" fill="none" className={className} aria-hidden="true">
        {!isFlatS9 && (
          <>
            <path d="M41 17 L46 6 H76 L81 17 Z" fill="#27272a" stroke="#71717a" strokeWidth="1.4" strokeLinejoin="round" />
            <text x="61" y="13.5" textAnchor="middle" fill="#f4f4f5" fontSize="4.2" fontWeight="700" letterSpacing="0.9">LUMIX</text>
          </>
        )}
        {/* Top Mode Dial + Signature Lumix Crimson Ring / REC Button */}
        <rect x="85" y="11" width="14" height="6" rx="1" fill="#3f3f46" stroke="#71717a" strokeWidth="1" />
        <line x1="85.5" y1="15.5" x2="98.5" y2="15.5" stroke="#dc2626" strokeWidth="1.4" />
        <circle cx="29" cy="14" r="2.2" fill="#dc2626" />
        <rect x="16" y="12" width="10" height="5" rx="1" fill="#3f3f46" stroke="#71717a" strokeWidth="1" />
        {/* Chassis */}
        <rect x="11" y="17" width="98" height="49" rx={isFlatS9 ? "6" : "4.5"} fill="#18181b" stroke="#52525b" strokeWidth="1.4" />
        {isFlatS9 ? (
          <>
            <path d="M11 22 C11 19 13.5 17 16.5 17 H103.5 C106.5 17 109 19 109 22 V26 H11 V22 Z" fill="#27272a" />
            <text x="31" y="23.5" textAnchor="middle" fill="#e4e4e7" fontSize="4.3" fontWeight="700" letterSpacing="0.8">LUMIX</text>
          </>
        ) : (
          <path d="M11 17 H29 V66 H15.5 C13 66 11 64 11 61.5 V17 Z" fill="#27272a" stroke="#52525b" strokeWidth="1.2" />
        )}
        {/* Crimson/White Lumix S Badge */}
        <rect x="93" y="24" width="9" height="7" rx="1" fill="#27272a" stroke="#dc2626" strokeWidth="0.9" />
        <text x="97.5" y="29.3" textAnchor="middle" fill="#f4f4f5" fontSize="5" fontWeight="700">S</text>
        {/* L-Mount Silver Bayonet + Sensor */}
        <circle cx="62" cy="43" r="20" fill="#d4d4d8" stroke="#52525b" strokeWidth="1.2" />
        <circle cx="62" cy="43" r="16.2" fill="#09090b" />
        <circle cx="62" cy="24.8" r="1.3" fill="#dc2626" />
        <rect x="51.5" y="36" width="21" height="14" rx="1" fill="#134e4a" stroke="#38bdf8" strokeWidth="0.6" strokeOpacity="0.65" />
      </svg>
    );
  }

  // 5. Canon EOS R Series — Smooth Curved EOS Pentaprism Dome, Sloped Grip, RF Mount
  if (lower.includes("canon") || lower.includes("eos") || /\br[135678]\b|\br50\b/i.test(lower)) {
    return (
      <svg viewBox="0 0 120 74" fill="none" className={className} aria-hidden="true">
        {/* Smooth Curved Canon Pentaprism Dome */}
        <path d="M40 17 C43 7 49 6 61 6 C73 6 79 7 82 17 Z" fill="#27272a" stroke="#71717a" strokeWidth="1.4" />
        <text x="61" y="14" textAnchor="middle" fill="#f4f4f5" fontSize="4.4" fontWeight="700" letterSpacing="0.8">Canon</text>
        <rect x="85" y="11.5" width="13" height="5.5" rx="1" fill="#3f3f46" stroke="#71717a" strokeWidth="1" />
        <path d="M13 16 L26 11 L30 17 H13 Z" fill="#3f3f46" stroke="#71717a" strokeWidth="1" />
        <rect x="11" y="17" width="98" height="49" rx="6" fill="#18181b" stroke="#52525b" strokeWidth="1.4" />
        <path d="M11 17 H29 C30 30 29 52 27 66 H16 C13 66 11 64 11 61 V17 Z" fill="#27272a" stroke="#52525b" strokeWidth="1.2" />
        <text x="96" y="29" textAnchor="middle" fill="#e4e4e7" fontSize="5.5" fontWeight="700">R</text>
        {/* Large RF Mount + Red Alignment Mark */}
        <circle cx="62" cy="43" r="20.5" fill="#d4d4d8" stroke="#52525b" strokeWidth="1.2" />
        <circle cx="62" cy="43" r="16.8" fill="#09090b" />
        <rect x="60.8" y="23.2" width="2.4" height="2.4" rx="0.5" fill="#dc2626" />
        <rect x="51.5" y="36" width="21" height="14" rx="1" fill="#0f5156" stroke="#6ee7b7" strokeWidth="0.6" strokeOpacity="0.65" />
      </svg>
    );
  }

  // 6. Fujifilm GFX Medium Format
  if (lower.includes("gfx")) {
    return (
      <svg viewBox="0 0 120 74" fill="none" className={className} aria-hidden="true">
        <path d="M40 17 L45 6 H77 L82 17 Z" fill="#27272a" stroke="#71717a" strokeWidth="1.4" strokeLinejoin="round" />
        <rect x="52" y="10" width="18" height="2.5" rx="0.5" fill="#e4e4e7" fillOpacity="0.8" />
        <rect x="86" y="11" width="13" height="6" rx="1" fill="#3f3f46" stroke="#71717a" strokeWidth="1" />
        <path d="M14 15 L26 11 L29 17 H14 Z" fill="#3f3f46" stroke="#71717a" strokeWidth="1" />
        <rect x="11" y="17" width="98" height="50" rx="5" fill="#18181b" stroke="#52525b" strokeWidth="1.4" />
        <path d="M11 17 H29 C30 28 30 52 28 67 H16 C13 67 11 65 11 62 V17 Z" fill="#27272a" stroke="#52525b" strokeWidth="1.2" />
        <rect x="92" y="24" width="11" height="5" rx="0.8" fill="#27272a" stroke="#ef4444" strokeWidth="1" />
        <text x="97.5" y="28" textAnchor="middle" fill="#f4f4f5" fontSize="4.2" fontWeight="700">GFX</text>
        <circle cx="62" cy="43" r="21" fill="#d4d4d8" stroke="#52525b" strokeWidth="1.3" />
        <circle cx="62" cy="43" r="17.5" fill="#09090b" />
        <circle cx="62" cy="23.8" r="1.3" fill="#ef4444" />
        <rect x="49.5" y="33.5" width="25" height="19" rx="1.2" fill="#065f46" stroke="#6ee7b7" strokeWidth="0.7" strokeOpacity="0.7" />
      </svg>
    );
  }

  // 7. Fujifilm X-Series (X-T5, X100VI, X-Pro3, X-E4, X-M5, X-S20, X-H2) — Silver/Graphite Retro Twin-Dial Body
  if (lower.includes("fuji") || /\bx-[tshpem]\d|\bx100/i.test(lower)) {
    const hasPrism = lower.includes("x-t") || lower.includes("x-h") || lower.includes("x-s");
    return (
      <svg viewBox="0 0 120 74" fill="none" className={className} aria-hidden="true">
        {hasPrism && (
          <path d="M44 16 L50 6 H72 L78 16 Z" fill="#d4d4d8" stroke="#71717a" strokeWidth="1.2" strokeLinejoin="round" />
        )}
        {/* Twin Machined Silver Top Dials */}
        <rect x="20" y="9.5" width="15" height="6.5" rx="1" fill="#d4d4d8" stroke="#52525b" strokeWidth="1" />
        <rect x="83" y="9.5" width="16" height="6.5" rx="1" fill="#d4d4d8" stroke="#52525b" strokeWidth="1" />
        <rect x="11" y="16" width="98" height="50" rx="5.5" fill="#18181b" stroke="#52525b" strokeWidth="1.4" />
        {/* Classic Silver Top Plate */}
        <path d="M11 21 C11 18.2 13.2 16 16 16 H104 C106.8 16 109 18.2 109 21 V27 H11 V21 Z" fill="#d4d4d8" stroke="#71717a" strokeWidth="1" />
        {!hasPrism && (
          <rect x="86" y="19" width="12" height="6" rx="1" fill="#0f172a" stroke="#52525b" strokeWidth="0.9" />
        )}
        <circle cx="62" cy="44" r="19" fill="#d4d4d8" stroke="#52525b" strokeWidth="1.2" />
        <circle cx="62" cy="44" r="15.2" fill="#09090b" />
        <circle cx="62" cy="26.5" r="1.2" fill="#ef4444" />
        <rect x="53" y="38" width="18" height="12" rx="1" fill="#065f46" stroke="#34d399" strokeWidth="0.6" strokeOpacity="0.7" />
      </svg>
    );
  }

  // 8. Hasselblad X2D / X1D
  if (lower.includes("hasselblad") || lower.includes("x2d") || lower.includes("x1d") || lower.includes("907x")) {
    return (
      <svg viewBox="0 0 120 74" fill="none" className={className} aria-hidden="true">
        <path d="M41 17 L47 6 H77 L83 17 Z" fill="#52525b" stroke="#a1a1aa" strokeWidth="1.2" strokeLinejoin="round" />
        <text x="62" y="14" textAnchor="middle" fill="#f4f4f5" fontSize="5.5" fontWeight="700" letterSpacing="1">H</text>
        <rect x="12" y="17" width="96" height="49" rx="5" fill="#18181b" stroke="#52525b" strokeWidth="1.4" />
        <path d="M12 21 C12 18.8 13.8 17 16 17 H104 C106.2 17 108 18.8 108 21 V26 H12 V21 Z" fill="#52525b" />
        <path d="M12 17 H30 L27 66 H17 C14.2 66 12 63.8 12 61 V17 Z" fill="#27272a" stroke="#52525b" strokeWidth="1.2" />
        <ellipse cx="21" cy="15.5" rx="5.5" ry="2.3" transform="rotate(-8 21 15.5)" fill="#f97316" />
        <circle cx="64" cy="43" r="20.5" fill="#a1a1aa" stroke="#52525b" strokeWidth="1.2" />
        <circle cx="64" cy="43" r="17" fill="#09090b" />
        <rect x="52" y="34" width="24" height="18" rx="1.2" fill="#0f766e" stroke="#5eead4" strokeWidth="0.7" strokeOpacity="0.65" />
      </svg>
    );
  }

  // 9. Ricoh GR III / IIIx — Stealth Pocket Street Compact
  if (lower.includes("ricoh") || /\bgr\s?(iii|ii|3|4)/i.test(lower)) {
    return (
      <svg viewBox="0 0 120 74" fill="none" className={className} aria-hidden="true">
        <rect x="21" y="13" width="13" height="4" rx="1" fill="#3f3f46" />
        <rect x="14" y="17" width="92" height="48" rx="7" fill="#18181b" stroke="#52525b" strokeWidth="1.4" />
        <path d="M14 17 H30 V65 H20 C16.7 65 14 62.3 14 59 V17 Z" fill="#27272a" />
        <text x="93" y="57" textAnchor="middle" fill="#d4d4d8" fontSize="6" fontWeight="700">GR</text>
        <circle cx="63" cy="41" r="18.5" fill="#27272a" stroke="#71717a" strokeWidth="1.3" />
        <circle cx="63" cy="41" r="14.5" fill="#09090b" stroke="#ca8a04" strokeWidth="1" />
        <circle cx="63" cy="41" r="8.5" fill="#0f172a" stroke="#52525b" strokeWidth="1" />
      </svg>
    );
  }

  // 10. Sony Alpha (A7R V / A7C / A1 / A9)
  if (lower.includes("sony") || lower.includes("ilce") || /\ba[179]\b|\ba7[rcsm]|\ba6\d\d\d|\bzv-e/i.test(lower)) {
    return (
      <svg viewBox="0 0 120 74" fill="none" className={className} aria-hidden="true">
        <path d="M43 17 L49 6 H73 L79 17 Z" fill="#27272a" stroke="#71717a" strokeWidth="1.4" strokeLinejoin="round" />
        <rect x="54" y="10.5" width="14" height="2.2" rx="0.5" fill="#e4e4e7" fillOpacity="0.85" />
        <rect x="84" y="11" width="13" height="6" rx="1" fill="#3f3f46" stroke="#71717a" strokeWidth="1" />
        <rect x="17" y="12" width="12" height="5" rx="1" fill="#3f3f46" stroke="#71717a" strokeWidth="1" />
        <rect x="12" y="17" width="96" height="49" rx="4.5" fill="#18181b" stroke="#52525b" strokeWidth="1.4" />
        <path d="M12 17 H29 V66 H16.5 C14 66 12 64 12 61.5 V17 Z" fill="#27272a" stroke="#52525b" strokeWidth="1.2" />
        <rect x="16" y="24" width="9" height="2.8" rx="1" fill="#a1a1aa" />
        <text x="96" y="29" textAnchor="middle" fill="#f97316" fontSize="8" fontWeight="700">α</text>
        <circle cx="61" cy="43" r="20" fill="#ea580c" stroke="#9a3412" strokeWidth="1" />
        <circle cx="61" cy="43" r="17.5" fill="#d4d4d8" />
        <circle cx="61" cy="43" r="14.8" fill="#09090b" />
        <rect x="50.5" y="36" width="21" height="14" rx="1" fill="#0f5156" stroke="#6ee7b7" strokeWidth="0.6" strokeOpacity="0.65" />
      </svg>
    );
  }

  // 11. Clean Neutral Mirrorless Body Fallback (No brand-specific badge)
  return (
    <svg viewBox="0 0 120 74" fill="none" className={className} aria-hidden="true">
      <path d="M43 17 L49 7 H73 L79 17 Z" fill="#27272a" stroke="#71717a" strokeWidth="1.4" strokeLinejoin="round" />
      <rect x="84" y="11.5" width="13" height="5.5" rx="1" fill="#3f3f46" stroke="#71717a" strokeWidth="1" />
      <rect x="17" y="12" width="12" height="5" rx="1" fill="#3f3f46" stroke="#71717a" strokeWidth="1" />
      <rect x="12" y="17" width="96" height="49" rx="5" fill="#18181b" stroke="#52525b" strokeWidth="1.4" />
      <path d="M12 17 H29 V66 H16.5 C14 66 12 64 12 61.5 V17 Z" fill="#27272a" stroke="#52525b" strokeWidth="1.2" />
      <circle cx="62" cy="43" r="19.5" fill="#d4d4d8" stroke="#52525b" strokeWidth="1.2" />
      <circle cx="62" cy="43" r="15.8" fill="#09090b" />
      <rect x="51.5" y="36" width="21" height="14" rx="1" fill="#0f5156" stroke="#6ee7b7" strokeWidth="0.6" strokeOpacity="0.6" />
    </svg>
  );
}

export function LensIllustration({ name, className = "h-12 w-auto" }: GearSvgProps & { focalMm?: number }) {
  const lower = name.toLowerCase();
  const isZoom = /(?:^|[^\d.])\d{1,3}\s*-\s*\d{2,4}/.test(lower);

  // 1. Nikon NIKKOR Z Lenses (Prime & S-Line Zoom e.g. NIKKOR Z 24-120mm f/4 S)
  if (lower.includes("nikkor") || lower.includes("nikon")) {
    const isSLine = /\bs\b/i.test(lower);
    if (isZoom) {
      return (
        <svg viewBox="0 0 96 60" fill="none" className={className} aria-hidden="true">
          {/* Silver Z-Mount Flange */}
          <rect x="6" y="16" width="5" height="28" rx="1" fill="#d4d4d8" stroke="#71717a" strokeWidth="1" />
          {/* Rear Stepped Barrel + Control Ring */}
          <rect x="11" y="13" width="20" height="34" rx="1.5" fill="#27272a" stroke="#71717a" strokeWidth="1.2" />
          <rect x="15" y="13" width="6" height="34" fill="#18181b" stroke="#52525b" strokeWidth="0.9" />
          {/* Main Stepped S-Line Zoom Barrel */}
          <rect x="31" y="10" width="46" height="40" rx="2" fill="#27272a" stroke="#71717a" strokeWidth="1.2" />
          {/* Broad Ribbed Zoom Ring */}
          <rect x="44" y="10" width="22" height="40" fill="#18181b" stroke="#52525b" strokeWidth="1" />
          <line x1="48" y1="11" x2="48" y2="49" stroke="#52525b" strokeWidth="1" />
          <line x1="52.5" y1="11" x2="52.5" y2="49" stroke="#52525b" strokeWidth="1" />
          <line x1="57" y1="11" x2="57" y2="49" stroke="#52525b" strokeWidth="1" />
          <line x1="61.5" y1="11" x2="61.5" y2="49" stroke="#52525b" strokeWidth="1" />
          {/* Silver S-Line Badge & Satin Silver Trim */}
          {isSLine && (
            <>
              <rect x="34" y="25" width="7" height="7" rx="1" fill="#e4e4e7" />
              <text x="37.5" y="30.2" textAnchor="middle" fill="#09090b" fontSize="5" fontWeight="700">S</text>
              <line x1="29" y1="13.5" x2="29" y2="46.5" stroke="#d4d4d8" strokeWidth="1.5" />
            </>
          )}
          {/* Front Barrel + ARNEO Coated Glass */}
          <rect x="77" y="11.5" width="8" height="37" rx="1" fill="#18181b" stroke="#71717a" strokeWidth="1.1" />
          <path d="M85 13.5 Q90 30 85 46.5" fill="#38bdf8" fillOpacity="0.22" stroke="#34d399" strokeWidth="1.6" />
        </svg>
      );
    }
    return (
      <svg viewBox="0 0 96 60" fill="none" className={className} aria-hidden="true">
        <rect x="12" y="16" width="5" height="28" rx="1" fill="#d4d4d8" stroke="#71717a" strokeWidth="1" />
        <rect x="17" y="12" width="52" height="36" rx="2" fill="#27272a" stroke="#71717a" strokeWidth="1.2" />
        <rect x="36" y="12" width="20" height="36" fill="#18181b" stroke="#52525b" strokeWidth="1" />
        <line x1="41" y1="13" x2="41" y2="47" stroke="#52525b" strokeWidth="1" />
        <line x1="46" y1="13" x2="46" y2="47" stroke="#52525b" strokeWidth="1" />
        <line x1="51" y1="13" x2="51" y2="47" stroke="#52525b" strokeWidth="1" />
        {isSLine && (
          <>
            <rect x="23" y="26" width="7" height="7" rx="1" fill="#e4e4e7" />
            <text x="26.5" y="31.2" textAnchor="middle" fill="#09090b" fontSize="5" fontWeight="700">S</text>
          </>
        )}
        <rect x="69" y="13.5" width="8" height="33" rx="1" fill="#18181b" stroke="#71717a" strokeWidth="1.1" />
        <path d="M77 15 Q82 30 77 45" fill="#38bdf8" fillOpacity="0.22" stroke="#34d399" strokeWidth="1.6" />
      </svg>
    );
  }

  // 2. Panasonic LUMIX S / G Lenses (e.g. LUMIX S 24-60/F2.8, 20-60, 50/F1.8)
  if (lower.includes("lumix") || lower.includes("panasonic") || lower.includes("leica dg")) {
    const isPro = lower.includes("pro");
    return (
      <svg viewBox="0 0 96 60" fill="none" className={className} aria-hidden="true">
        <rect x={isZoom ? "7" : "13"} y="16" width="5" height="28" rx="1" fill="#d4d4d8" stroke="#71717a" strokeWidth="1" />
        <rect
          x={isZoom ? "12" : "18"}
          y="11"
          width={isZoom ? "64" : "50"}
          height="38"
          rx="2"
          fill="#27272a"
          stroke="#71717a"
          strokeWidth="1.2"
        />
        {/* Focus + Zoom Ribbed Rings */}
        {isZoom && (
          <>
            <rect x="25" y="11" width="15" height="38" fill="#18181b" stroke="#52525b" strokeWidth="1" />
            <line x1="29.5" y1="12" x2="29.5" y2="48" stroke="#52525b" strokeWidth="1" />
            <line x1="35" y1="12" x2="35" y2="48" stroke="#52525b" strokeWidth="1" />
          </>
        )}
        <rect x={isZoom ? "48" : "37"} y="11" width="18" height="38" fill="#18181b" stroke="#52525b" strokeWidth="1" />
        <line x1={isZoom ? "52.5" : "41.5"} y1="12" x2={isZoom ? "52.5" : "41.5"} y2="48" stroke="#52525b" strokeWidth="1" />
        <line x1={isZoom ? "57" : "46"} y1="12" x2={isZoom ? "57" : "46"} y2="48" stroke="#52525b" strokeWidth="1" />
        <line x1={isZoom ? "61.5" : "50.5"} y1="12" x2={isZoom ? "61.5" : "50.5"} y2="48" stroke="#52525b" strokeWidth="1" />
        {/* Signature LUMIX S Vertical Satin Metallic Accent Line & Badge */}
        <line
          x1={isZoom ? "19" : "25"}
          y1="12"
          x2={isZoom ? "19" : "25"}
          y2="48"
          stroke={isPro ? "#dc2626" : "#e4e4e7"}
          strokeWidth="2"
        />
        <text x={isZoom ? "44" : "31"} y="32" textAnchor="middle" fill="#f4f4f5" fontSize="5.5" fontWeight="700">S</text>
        <rect x={isZoom ? "76" : "68"} y="12.5" width="7" height="35" rx="1" fill="#18181b" stroke="#71717a" strokeWidth="1.1" />
        <path
          d={isZoom ? "M83 14.5 Q88 30 83 45.5" : "M75 14.5 Q80 30 75 45.5"}
          fill="#34d399"
          fillOpacity="0.22"
          stroke="#38bdf8"
          strokeWidth="1.6"
        />
      </svg>
    );
  }

  // 3. Fujifilm XC / XF Fujinon X-Mount Lenses (e.g. XC35mmF2, XF23mmF1.4, XF16-55mmF2.8)
  if (lower.includes("xc") || lower.includes("xf") || lower.includes("fujinon")) {
    const isCompactXcPrime = lower.includes("xc") && !isZoom;
    if (isCompactXcPrime) {
      return (
        <svg viewBox="0 0 96 60" fill="none" className={className} aria-hidden="true">
          <rect x="20" y="18" width="5" height="24" rx="1" fill="#52525b" stroke="#71717a" strokeWidth="1" />
          {/* Ultra-compact Tapered XC35mmF2 Barrel */}
          <rect x="25" y="15" width="34" height="30" rx="2" fill="#27272a" stroke="#71717a" strokeWidth="1.2" />
          <rect x="35" y="15" width="14" height="30" fill="#18181b" stroke="#52525b" strokeWidth="1" />
          <line x1="39" y1="16" x2="39" y2="44" stroke="#52525b" strokeWidth="1" />
          <line x1="44" y1="16" x2="44" y2="44" stroke="#52525b" strokeWidth="1" />
          <path d="M59 16.5 L68 18 V42 L59 43.5 Z" fill="#18181b" stroke="#71717a" strokeWidth="1.1" />
          <path d="M68 19 Q73 30 68 41" fill="#34d399" fillOpacity="0.25" stroke="#38bdf8" strokeWidth="1.6" />
        </svg>
      );
    }
    return (
      <svg viewBox="0 0 96 60" fill="none" className={className} aria-hidden="true">
        <rect x={isZoom ? "8" : "14"} y="16" width="5" height="28" rx="1" fill="#d4d4d8" stroke="#71717a" strokeWidth="1" />
        <rect
          x={isZoom ? "13" : "19"}
          y="12"
          width={isZoom ? "60" : "46"}
          height="36"
          rx="2"
          fill="#27272a"
          stroke="#71717a"
          strokeWidth="1.2"
        />
        {/* XF Milled Aperture Ring + Focus/Zoom Ring */}
        <rect x={isZoom ? "20" : "25"} y="12" width="9" height="36" fill="#18181b" stroke="#52525b" strokeWidth="1" />
        <rect x={isZoom ? "40" : "41"} y="12" width="19" height="36" fill="#18181b" stroke="#52525b" strokeWidth="1" />
        <line x1={isZoom ? "45" : "46"} y1="13" x2={isZoom ? "45" : "46"} y2="47" stroke="#52525b" strokeWidth="1" />
        <line x1={isZoom ? "50" : "51"} y1="13" x2={isZoom ? "50" : "51"} y2="47" stroke="#52525b" strokeWidth="1" />
        <line x1={isZoom ? "55" : "56"} y1="13" x2={isZoom ? "55" : "56"} y2="47" stroke="#52525b" strokeWidth="1" />
        <rect x={isZoom ? "73" : "65"} y="13.5" width="7" height="33" rx="1" fill="#18181b" stroke="#71717a" strokeWidth="1.1" />
        <path
          d={isZoom ? "M80 15 Q85 30 80 45" : "M72 15 Q77 30 72 45"}
          fill="#34d399"
          fillOpacity="0.22"
          stroke="#38bdf8"
          strokeWidth="1.6"
        />
      </svg>
    );
  }

  // 4. Canon RF / EF Lenses (Silver Control Ring + Red L-Ring for L Series)
  if (/\brf\s?\d|\bef\s?\d|canon/i.test(lower)) {
    const isL = /\bl\b/i.test(lower);
    return (
      <svg viewBox="0 0 96 60" fill="none" className={className} aria-hidden="true">
        <rect x={isZoom ? "7" : "13"} y="16" width="5" height="28" rx="1" fill="#d4d4d8" stroke="#71717a" strokeWidth="1" />
        <rect
          x={isZoom ? "12" : "18"}
          y="11"
          width={isZoom ? "63" : "49"}
          height="38"
          rx="2"
          fill="#27272a"
          stroke="#71717a"
          strokeWidth="1.2"
        />
        <rect x="20" y="11" width="4" height="38" fill="#a1a1aa" />
        <rect x={isZoom ? "35" : "36"} y="11" width="20" height="38" fill="#18181b" stroke="#52525b" strokeWidth="1" />
        <line x1="41" y1="12" x2="41" y2="48" stroke="#52525b" strokeWidth="1" />
        <line x1="46" y1="12" x2="46" y2="48" stroke="#52525b" strokeWidth="1" />
        <line x1="51" y1="12" x2="51" y2="48" stroke="#52525b" strokeWidth="1" />
        {/* Iconic Canon Crimson L-Ring */}
        {isL && (
          <line
            x1={isZoom ? "68" : "60"}
            y1="11.5"
            x2={isZoom ? "68" : "60"}
            y2="48.5"
            stroke="#dc2626"
            strokeWidth="2.4"
          />
        )}
        <rect x={isZoom ? "75" : "67"} y="12.5" width="7" height="35" rx="1" fill="#18181b" stroke="#71717a" strokeWidth="1.1" />
        <path
          d={isZoom ? "M82 14.5 Q87 30 82 45.5" : "M74 14.5 Q79 30 74 45.5"}
          fill="#38bdf8"
          fillOpacity="0.22"
          stroke="#34d399"
          strokeWidth="1.6"
        />
      </svg>
    );
  }

  // 5. Leica Summilux / Summicron / Elmarit
  if (lower.includes("summilux") || lower.includes("summicron") || lower.includes("elmarit") || lower.includes("apo-")) {
    return (
      <svg viewBox="0 0 96 60" fill="none" className={className} aria-hidden="true">
        <rect x="12" y="17" width="6" height="26" rx="1" fill="#d4d4d8" stroke="#71717a" strokeWidth="1" />
        <rect x="18" y="13" width="38" height="34" rx="2" fill="#27272a" stroke="#71717a" strokeWidth="1.2" />
        <rect x="29" y="13" width="13" height="34" fill="#18181b" stroke="#52525b" strokeWidth="1" />
        <line x1="32" y1="14" x2="32" y2="46" stroke="#71717a" strokeWidth="1" />
        <line x1="35.5" y1="14" x2="35.5" y2="46" stroke="#71717a" strokeWidth="1" />
        <line x1="39" y1="14" x2="39" y2="46" stroke="#71717a" strokeWidth="1" />
        <circle cx="23" cy="30" r="2" fill="#dc2626" />
        <line x1="47" y1="18" x2="47" y2="42" stroke="#eab308" strokeWidth="1" strokeDasharray="2 2" />
        <path d="M32 47 L34 54 H40 L42 47 Z" fill="#3f3f46" stroke="#71717a" strokeWidth="1" />
        <path d="M56 14 L74 10 V50 L56 46 Z" fill="#27272a" stroke="#71717a" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M74 13 Q80 30 74 47" fill="#34d399" fillOpacity="0.22" stroke="#38bdf8" strokeWidth="1.8" />
      </svg>
    );
  }

  // 6. Sony G Master / G / FE
  if (lower.includes("gm") || lower.includes("fe ") || lower.includes("sony")) {
    const isGM = lower.includes("gm");
    return (
      <svg viewBox="0 0 96 60" fill="none" className={className} aria-hidden="true">
        <rect x="8" y="17" width="6" height="26" rx="1" fill="#d4d4d8" stroke="#71717a" strokeWidth="1" />
        <rect x="14" y="11" width="50" height="38" rx="2" fill="#27272a" stroke="#71717a" strokeWidth="1.2" />
        <rect x="36" y="11" width="20" height="38" fill="#18181b" stroke="#52525b" strokeWidth="1" />
        <line x1="40" y1="12" x2="40" y2="48" stroke="#52525b" strokeWidth="1" />
        <line x1="44" y1="12" x2="44" y2="48" stroke="#52525b" strokeWidth="1" />
        <line x1="48" y1="12" x2="48" y2="48" stroke="#52525b" strokeWidth="1" />
        <line x1="52" y1="12" x2="52" y2="48" stroke="#52525b" strokeWidth="1" />
        <rect x="21" y="24" width="8" height="8" rx="1.2" fill={isGM ? "#ea580c" : "#3f3f46"} />
        <text x="25" y="30" textAnchor="middle" fill="#ffffff" fontSize="5.5" fontWeight="700">G</text>
        <circle cx="25" cy="17" r="2.2" fill="#27272a" stroke="#a1a1aa" strokeWidth="0.8" />
        <path d="M64 11 L86 7 L80 20 L87 30 L80 40 L86 53 L64 49 Z" fill="#27272a" stroke="#71717a" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    );
  }

  // 7. Hasselblad XCD / Fujifilm GF Medium-Format Wide Barrel
  if (lower.includes("xcd") || lower.includes("gf")) {
    const isHasselblad = lower.includes("xcd");
    return (
      <svg viewBox="0 0 96 60" fill="none" className={className} aria-hidden="true">
        <rect x="10" y="15" width="6" height="30" rx="1" fill="#d4d4d8" stroke="#71717a" strokeWidth="1" />
        <rect x="16" y="9" width="54" height="42" rx="2.5" fill="#27272a" stroke="#71717a" strokeWidth="1.2" />
        <rect x="24" y="9" width="10" height="42" fill="#18181b" stroke="#52525b" strokeWidth="1" />
        <rect x="42" y="9" width="18" height="42" fill="#18181b" stroke="#52525b" strokeWidth="1" />
        <line x1="46" y1="10" x2="46" y2="50" stroke="#52525b" strokeWidth="1" />
        <line x1="51" y1="10" x2="51" y2="50" stroke="#52525b" strokeWidth="1" />
        <line x1="56" y1="10" x2="56" y2="50" stroke="#52525b" strokeWidth="1" />
        <line
          x1="65"
          y1="9.5"
          x2="65"
          y2="50.5"
          stroke={isHasselblad ? "#f97316" : "#dc2626"}
          strokeWidth="2.2"
        />
        <rect x="70" y="11" width="11" height="38" rx="1.2" fill="#27272a" stroke="#71717a" strokeWidth="1.2" />
        <path d="M81 13 Q87 30 81 47" fill="#38bdf8" fillOpacity="0.22" stroke="#34d399" strokeWidth="1.8" />
      </svg>
    );
  }

  // 8. Clean Neutral Optical Zoom / Prime Fallback (Sigma / Tamron / Voigtländer / Others)
  return (
    <svg viewBox="0 0 96 60" fill="none" className={className} aria-hidden="true">
      <rect x={isZoom ? "8" : "15"} y="16" width="5" height="28" rx="1" fill="#d4d4d8" stroke="#71717a" strokeWidth="1" />
      <rect
        x={isZoom ? "13" : "20"}
        y="12"
        width={isZoom ? "60" : "45"}
        height="36"
        rx="2"
        fill="#27272a"
        stroke="#71717a"
        strokeWidth="1.2"
      />
      {isZoom && <rect x="22" y="12" width="13" height="36" fill="#18181b" stroke="#52525b" strokeWidth="1" />}
      <rect x={isZoom ? "43" : "36"} y="12" width="18" height="36" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <line x1={isZoom ? "48" : "41"} y1="13" x2={isZoom ? "48" : "41"} y2="47" stroke="#52525b" strokeWidth="1" />
      <line x1={isZoom ? "54" : "47"} y1="13" x2={isZoom ? "54" : "47"} y2="47" stroke="#52525b" strokeWidth="1" />
      <rect x={isZoom ? "73" : "65"} y="13.5" width="7" height="33" rx="1" fill="#18181b" stroke="#71717a" strokeWidth="1.1" />
      <path
        d={isZoom ? "M80 15 Q85 30 80 45" : "M72 15 Q77 30 72 45"}
        fill="#38bdf8"
        fillOpacity="0.22"
        stroke="#34d399"
        strokeWidth="1.6"
      />
    </svg>
  );
}
