"use client";

interface GearSvgProps {
  name: string;
  className?: string;
}

export function CameraIllustration({ name, className = "h-16 w-auto" }: GearSvgProps) {
  const lower = name.toLowerCase();

  // 1. Leica M11 — Silver-chrome / black-paint brass rangefinder, optical windows, red dot, M-bayonet
  if (lower.includes("m11") || (lower.includes("leica") && !lower.includes("q"))) {
    return (
      <svg viewBox="0 0 120 74" fill="none" className={className} aria-hidden="true">
        <defs>
          <linearGradient id="m11-top" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#d4d4d8" />
            <stop offset="45%" stopColor="#f4f4f5" />
            <stop offset="100%" stopColor="#a1a1aa" />
          </linearGradient>
          <linearGradient id="m11-sensor" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#134e4a" />
            <stop offset="55%" stopColor="#1e3a8a" />
            <stop offset="100%" stopColor="#064e3b" />
          </linearGradient>
        </defs>
        {/* Top shutter & ISO dials */}
        <rect x="20" y="9" width="15" height="5" rx="1" fill="#a1a1aa" stroke="#52525b" strokeWidth="1" />
        <rect x="82" y="8" width="16" height="6" rx="1" fill="#d4d4d8" stroke="#52525b" strokeWidth="1" />
        <rect x="65" y="10" width="10" height="4" rx="0.8" fill="#71717a" />
        {/* Leatherette lower chassis */}
        <rect x="10" y="14" width="100" height="52" rx="8" fill="#18181b" stroke="#3f3f46" strokeWidth="1.4" />
        {/* Classic Silver-Chrome Rangefinder Top Plate */}
        <path d="M10 22 C10 17.5 13.5 14 18 14 H102 C106.5 14 110 17.5 110 22 V29 H10 V22 Z" fill="url(#m11-top)" stroke="#71717a" strokeWidth="1" />
        {/* Silver baseplate */}
        <path d="M12 62 H108 C107 65 104.5 66 102 66 H18 C15.5 66 13 65 12 62 Z" fill="#a1a1aa" />
        {/* Viewfinder, Frame-line & Rangefinder Windows */}
        <rect x="19" y="17.5" width="15" height="8" rx="1.2" fill="#0f172a" stroke="#52525b" strokeWidth="1" />
        <rect x="21" y="19" width="6" height="3" rx="0.5" fill="#38bdf8" fillOpacity="0.45" />
        <rect x="43" y="19" width="7" height="5.5" rx="0.8" fill="#e4e4e7" stroke="#71717a" strokeWidth="0.8" />
        <rect x="86" y="18.5" width="11" height="6.5" rx="1" fill="#0f172a" stroke="#52525b" strokeWidth="1" />
        <circle cx="91.5" cy="21.7" r="2" fill="#38bdf8" fillOpacity="0.4" />
        {/* Iconic Red Leica Dot */}
        <circle cx="38" cy="36" r="4.2" fill="#dc2626" />
        <text x="38" y="37.8" textAnchor="middle" fill="#ffffff" fontSize="5" fontStyle="italic" fontWeight="700">L</text>
        {/* Lens release button */}
        <circle cx="43" cy="48" r="2.3" fill="#d4d4d8" stroke="#52525b" strokeWidth="0.8" />
        {/* Silver M-Bayonet Mount + Full-Frame Sensor */}
        <circle cx="69" cy="45" r="18.5" fill="#d4d4d8" stroke="#52525b" strokeWidth="1.2" />
        <circle cx="69" cy="45" r="14.5" fill="#09090b" stroke="#3f3f46" strokeWidth="1" />
        <circle cx="69" cy="28.3" r="1.3" fill="#dc2626" />
        <rect x="58.5" y="38" width="21" height="14" rx="1" fill="url(#m11-sensor)" stroke="#34d399" strokeWidth="0.6" strokeOpacity="0.6" />
      </svg>
    );
  }

  // 2. Leica Q3 — Matte black Bauhaus compact + Fixed Summilux 28mm f/1.7 multi-coated front glass
  if (lower.includes("q3") || lower.includes("q2")) {
    return (
      <svg viewBox="0 0 120 74" fill="none" className={className} aria-hidden="true">
        <defs>
          <radialGradient id="q3-glass" cx="38%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.55" />
            <stop offset="45%" stopColor="#1e1b4b" />
            <stop offset="100%" stopColor="#09090b" />
          </radialGradient>
        </defs>
        {/* Shutter release */}
        <rect x="22" y="10" width="14" height="4" rx="1" fill="#3f3f46" />
        <rect x="84" y="9" width="14" height="5" rx="1" fill="#52525b" />
        {/* Matte black anodized body */}
        <rect x="11" y="14" width="98" height="52" rx="7" fill="#18181b" stroke="#52525b" strokeWidth="1.4" />
        <path d="M11 21 C11 17 14 14 18 14 H102 C106 14 109 17 109 21 V27 H11 V21 Z" fill="#27272a" />
        {/* AF assist window & Red Dot */}
        <rect x="88" y="18.5" width="9" height="5" rx="1" fill="#09090b" stroke="#52525b" strokeWidth="0.9" />
        <circle cx="33" cy="25" r="4" fill="#dc2626" />
        <text x="33" y="26.8" textAnchor="middle" fill="#ffffff" fontSize="4.8" fontStyle="italic" fontWeight="700">L</text>
        {/* Fixed Summilux 28mm f/1.7 Barrel + Focus Tab */}
        <path d="M44 59 L40 66 H48 L50 61 Z" fill="#3f3f46" stroke="#71717a" strokeWidth="0.9" />
        <circle cx="65" cy="43" r="22" fill="#27272a" stroke="#71717a" strokeWidth="1.4" />
        <circle cx="65" cy="43" r="18.5" fill="#09090b" stroke="#52525b" strokeWidth="1" strokeDasharray="2.5 1.5" />
        <circle cx="65" cy="43" r="14" fill="url(#q3-glass)" stroke="#3f3f46" strokeWidth="1.2" />
        <ellipse cx="60" cy="38" rx="4.5" ry="2.2" transform="rotate(-28 60 38)" fill="#a7f3d0" fillOpacity="0.35" />
      </svg>
    );
  }

  // 3. Fujifilm GFX 100S II — Boxy Medium Format EVF hump, deep grip, red GFX badge, huge 44x33 sensor
  if (lower.includes("gfx") || lower.includes("fuji")) {
    return (
      <svg viewBox="0 0 120 74" fill="none" className={className} aria-hidden="true">
        <defs>
          <linearGradient id="gfx-sensor" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#065f46" />
            <stop offset="50%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#115e59" />
          </linearGradient>
        </defs>
        {/* Boxy Medium Format EVF housing */}
        <path d="M40 17 L45 6 H77 L82 17 Z" fill="#27272a" stroke="#71717a" strokeWidth="1.4" strokeLinejoin="round" />
        <rect x="52" y="10" width="18" height="2.5" rx="0.5" fill="#e4e4e7" fillOpacity="0.8" />
        {/* Mode dial & angled shutter */}
        <rect x="86" y="11" width="13" height="6" rx="1" fill="#3f3f46" stroke="#71717a" strokeWidth="1" />
        <path d="M14 15 L26 11 L29 17 H14 Z" fill="#3f3f46" stroke="#71717a" strokeWidth="1" />
        {/* Main Chassis */}
        <rect x="11" y="17" width="98" height="50" rx="5" fill="#18181b" stroke="#52525b" strokeWidth="1.4" />
        {/* Deep Right-Hand Grip (viewer left) */}
        <path d="M11 17 H29 C30 28 30 52 28 67 H16 C13 67 11 65 11 62 V17 Z" fill="#27272a" stroke="#52525b" strokeWidth="1.2" />
        <rect x="16" y="23" width="9" height="3" rx="1" fill="#a1a1aa" />
        {/* Red/Silver GFX Badge */}
        <rect x="92" y="24" width="11" height="5" rx="0.8" fill="#27272a" stroke="#ef4444" strokeWidth="1" />
        <text x="97.5" y="28" textAnchor="middle" fill="#f4f4f5" fontSize="4.2" fontWeight="700">GFX</text>
        {/* Large 44x33 G-Mount + Medium Format Sensor */}
        <circle cx="62" cy="43" r="21" fill="#d4d4d8" stroke="#52525b" strokeWidth="1.3" />
        <circle cx="62" cy="43" r="17.5" fill="#09090b" />
        <circle cx="62" cy="23.8" r="1.3" fill="#ef4444" />
        <rect x="49.5" y="33.5" width="25" height="19" rx="1.2" fill="url(#gfx-sensor)" stroke="#6ee7b7" strokeWidth="0.7" strokeOpacity="0.7" />
      </svg>
    );
  }

  // 4. Hasselblad X2D 100C — Space-grey machined top wedge, sculpted grip, orange shutter button
  if (lower.includes("hasselblad") || lower.includes("x2d")) {
    return (
      <svg viewBox="0 0 120 74" fill="none" className={className} aria-hidden="true">
        <defs>
          <linearGradient id="x2d-metal" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#52525b" />
            <stop offset="50%" stopColor="#71717a" />
            <stop offset="100%" stopColor="#3f3f46" />
          </linearGradient>
          <linearGradient id="x2d-sensor" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0f766e" />
            <stop offset="50%" stopColor="#1d4ed8" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>
        </defs>
        {/* Scandinavian Angled Top Wedge */}
        <path d="M41 17 L47 6 H77 L83 17 Z" fill="url(#x2d-metal)" stroke="#a1a1aa" strokeWidth="1.2" strokeLinejoin="round" />
        <text x="62" y="14" textAnchor="middle" fill="#f4f4f5" fontSize="5.5" fontWeight="700" letterSpacing="1">H</text>
        {/* Main Body */}
        <rect x="12" y="17" width="96" height="49" rx="5" fill="#18181b" stroke="#52525b" strokeWidth="1.4" />
        {/* Machined Space-Grey Top Deck */}
        <path d="M12 21 C12 18.8 13.8 17 16 17 H104 C106.2 17 108 18.8 108 21 V26 H12 V21 Z" fill="url(#x2d-metal)" />
        {/* Sculpted Grip + Signature Orange Shutter Button */}
        <path d="M12 17 H30 L27 66 H17 C14.2 66 12 63.8 12 61 V17 Z" fill="#27272a" stroke="#52525b" strokeWidth="1.2" />
        <ellipse cx="21" cy="15.5" rx="5.5" ry="2.3" transform="rotate(-8 21 15.5)" fill="#f97316" />
        {/* Huge XCD Mount + Medium Format Sensor */}
        <circle cx="64" cy="43" r="20.5" fill="#a1a1aa" stroke="#52525b" strokeWidth="1.2" />
        <circle cx="64" cy="43" r="17" fill="#09090b" />
        <rect x="52" y="34" width="24" height="18" rx="1.2" fill="url(#x2d-sensor)" stroke="#5eead4" strokeWidth="0.7" strokeOpacity="0.65" />
      </svg>
    );
  }

  // 5. Sony Alpha A7R V — Faceted pentaprism EVF, Cinnabar-Orange E-Mount ring, α badge
  return (
    <svg viewBox="0 0 120 74" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="sony-sensor" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#065f46" />
          <stop offset="55%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#0f766e" />
        </linearGradient>
      </defs>
      {/* Faceted Sony Alpha EVF Pentaprism */}
      <path d="M43 17 L49 6 H73 L79 17 Z" fill="#27272a" stroke="#71717a" strokeWidth="1.4" strokeLinejoin="round" />
      <rect x="54" y="10.5" width="14" height="2.2" rx="0.5" fill="#e4e4e7" fillOpacity="0.85" />
      {/* Top Dials */}
      <rect x="84" y="11" width="13" height="6" rx="1" fill="#3f3f46" stroke="#71717a" strokeWidth="1" />
      <rect x="17" y="12" width="12" height="5" rx="1" fill="#3f3f46" stroke="#71717a" strokeWidth="1" />
      {/* Body + Grip */}
      <rect x="12" y="17" width="96" height="49" rx="4.5" fill="#18181b" stroke="#52525b" strokeWidth="1.4" />
      <path d="M12 17 H29 V66 H16.5 C14 66 12 64 12 61.5 V17 Z" fill="#27272a" stroke="#52525b" strokeWidth="1.2" />
      <rect x="16" y="24" width="9" height="2.8" rx="1" fill="#a1a1aa" />
      {/* Alpha α emblem */}
      <text x="96" y="29" textAnchor="middle" fill="#f97316" fontSize="8" fontWeight="700">α</text>
      {/* Signature Cinnabar-Orange E-Mount Ring + Full-Frame Sensor */}
      <circle cx="61" cy="43" r="20" fill="#ea580c" stroke="#9a3412" strokeWidth="1" />
      <circle cx="61" cy="43" r="17.5" fill="#d4d4d8" />
      <circle cx="61" cy="43" r="14.8" fill="#09090b" />
      <rect x="50.5" y="36" width="21" height="14" rx="1" fill="url(#sony-sensor)" stroke="#6ee7b7" strokeWidth="0.6" strokeOpacity="0.65" />
    </svg>
  );
}

export function LensIllustration({ name, className = "h-12 w-auto" }: GearSvgProps & { focalMm?: number }) {
  const lower = name.toLowerCase();

  // 1. Leica Summilux / Summicron — Compact anodized barrel, aperture scale, focus tab, multi-coated glass
  if (lower.includes("summilux") || lower.includes("summicron")) {
    return (
      <svg viewBox="0 0 96 60" fill="none" className={className} aria-hidden="true">
        <defs>
          <linearGradient id="leica-barrel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3f3f46" />
            <stop offset="32%" stopColor="#52525b" />
            <stop offset="70%" stopColor="#18181b" />
            <stop offset="100%" stopColor="#27272a" />
          </linearGradient>
        </defs>
        {/* Silver rear bayonet mount */}
        <rect x="12" y="17" width="6" height="26" rx="1" fill="#d4d4d8" stroke="#71717a" strokeWidth="1" />
        {/* Stepped compact barrel */}
        <rect x="18" y="13" width="38" height="34" rx="2" fill="url(#leica-barrel)" stroke="#71717a" strokeWidth="1.2" />
        {/* Knurled focus ring */}
        <rect x="29" y="13" width="13" height="34" fill="#18181b" stroke="#52525b" strokeWidth="1" />
        <line x1="32" y1="14" x2="32" y2="46" stroke="#71717a" strokeWidth="1" />
        <line x1="35.5" y1="14" x2="35.5" y2="46" stroke="#71717a" strokeWidth="1" />
        <line x1="39" y1="14" x2="39" y2="46" stroke="#71717a" strokeWidth="1" />
        {/* Red mounting dot & yellow/white scale */}
        <circle cx="23" cy="30" r="2" fill="#dc2626" />
        <line x1="47" y1="18" x2="47" y2="42" stroke="#eab308" strokeWidth="1" strokeDasharray="2 2" />
        {/* Finger focus tab underneath */}
        <path d="M32 47 L34 54 H40 L42 47 Z" fill="#3f3f46" stroke="#71717a" strokeWidth="1" />
        {/* Tapered metal hood + coated front element */}
        <path d="M56 14 L74 10 V50 L56 46 Z" fill="#27272a" stroke="#71717a" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M74 13 Q80 30 74 47" fill="#34d399" fillOpacity="0.22" stroke="#38bdf8" strokeWidth="1.8" />
      </svg>
    );
  }

  // 2. Sony G Master (FE 24mm / 35mm f/1.4 GM) — Wide focus ring, orange G badge, scalloped petal hood
  if (lower.includes("gm") || lower.includes("fe ")) {
    return (
      <svg viewBox="0 0 96 60" fill="none" className={className} aria-hidden="true">
        <defs>
          <linearGradient id="gm-barrel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3f3f46" />
            <stop offset="35%" stopColor="#52525b" />
            <stop offset="75%" stopColor="#18181b" />
            <stop offset="100%" stopColor="#27272a" />
          </linearGradient>
        </defs>
        <rect x="8" y="17" width="6" height="26" rx="1" fill="#d4d4d8" stroke="#71717a" strokeWidth="1" />
        <rect x="14" y="11" width="50" height="38" rx="2" fill="url(#gm-barrel)" stroke="#71717a" strokeWidth="1.2" />
        {/* Broad rubber focus ring */}
        <rect x="36" y="11" width="20" height="38" fill="#18181b" stroke="#52525b" strokeWidth="1" />
        <line x1="40" y1="12" x2="40" y2="48" stroke="#52525b" strokeWidth="1" />
        <line x1="44" y1="12" x2="44" y2="48" stroke="#52525b" strokeWidth="1" />
        <line x1="48" y1="12" x2="48" y2="48" stroke="#52525b" strokeWidth="1" />
        <line x1="52" y1="12" x2="52" y2="48" stroke="#52525b" strokeWidth="1" />
        {/* Signature Orange G Master Square Badge & Focus Hold button */}
        <rect x="21" y="24" width="8" height="8" rx="1.2" fill="#ea580c" />
        <text x="25" y="30" textAnchor="middle" fill="#ffffff" fontSize="5.5" fontWeight="700">G</text>
        <circle cx="25" cy="17" r="2.2" fill="#27272a" stroke="#a1a1aa" strokeWidth="0.8" />
        {/* Scalloped Petal Hood */}
        <path d="M64 11 L86 7 L80 20 L87 30 L80 40 L86 53 L64 49 Z" fill="#27272a" stroke="#71717a" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    );
  }

  // 3. Hasselblad XCD / Fujifilm GF Medium-Format Wide Barrel
  const isHasselblad = lower.includes("xcd");
  return (
    <svg viewBox="0 0 96 60" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="mf-barrel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3f3f46" />
          <stop offset="30%" stopColor="#52525b" />
          <stop offset="75%" stopColor="#18181b" />
          <stop offset="100%" stopColor="#27272a" />
        </linearGradient>
      </defs>
      <rect x="10" y="15" width="6" height="30" rx="1" fill="#d4d4d8" stroke="#71717a" strokeWidth="1" />
      {/* Fat Medium Format Barrel */}
      <rect x="16" y="9" width="54" height="42" rx="2.5" fill="url(#mf-barrel)" stroke="#71717a" strokeWidth="1.2" />
      {/* Milled Aperture & Focus Rings */}
      <rect x="24" y="9" width="10" height="42" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <rect x="42" y="9" width="18" height="42" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <line x1="46" y1="10" x2="46" y2="50" stroke="#52525b" strokeWidth="1" />
      <line x1="51" y1="10" x2="51" y2="50" stroke="#52525b" strokeWidth="1" />
      <line x1="56" y1="10" x2="56" y2="50" stroke="#52525b" strokeWidth="1" />
      {/* Brand Accent Ring (Hasselblad Orange V-ring / Fujifilm Red WR ring) */}
      <line
        x1="65"
        y1="9.5"
        x2="65"
        y2="50.5"
        stroke={isHasselblad ? "#f97316" : "#dc2626"}
        strokeWidth="2.2"
      />
      {/* Front Barrel & Large Glass Element */}
      <rect x="70" y="11" width="11" height="38" rx="1.2" fill="#27272a" stroke="#71717a" strokeWidth="1.2" />
      <path d="M81 13 Q87 30 81 47" fill="#38bdf8" fillOpacity="0.22" stroke="#34d399" strokeWidth="1.8" />
    </svg>
  );
}
