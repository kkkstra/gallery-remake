import type * as maplibregl from "maplibre-gl";

const rawStyleCache = new Map<"dark" | "light", maplibregl.StyleSpecification>();

// Only block non-sovereign entities from being labeled as "country" — keep "China / 中国" in CARTO's native country layer!
const BLOCKED_AS_COUNTRY = [
  "Taiwan",
  "Republic of China",
  "Hong Kong",
  "Macau",
  "Macao",
  "台湾",
  "臺灣",
  "中华民国",
  "香港",
  "澳门",
  "澳門",
];

const BLOCKED_WIKIDATA = [
  "Q1162", // Disputed Arunachal node
  "Q865", // Non-provincial ROC/Taiwan country node
  "Q234688", // Senkaku label node
  "Q215669", // Spratly foreign label node
  "Q376644", // Paracel foreign label node
];

const BLOCKED_DISPUTED_NAMES = [
  "Arunachal Pradesh",
  "阿鲁纳恰尔邦",
  "阿魯納恰爾邦",
  "阿魯納查邦",
  "阿鲁纳查邦",
  "Senkaku Islands",
  "Senkaku",
  "尖阁诸岛",
  "尖閣諸島",
  "Spratly Islands",
  "Paracel Islands",
  "Scarborough Shoal",
  "Pratas Islands",
  "Macclesfield Bank",
];

function getBaseStyleUrl(mode: "dark" | "light"): string {
  return mode === "dark"
    ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
    : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
}

export async function loadCompliantMapStyle(
  mode: "dark" | "light",
  locale: "zh" | "en" = "zh"
): Promise<maplibregl.StyleSpecification> {
  let base = rawStyleCache.get(mode);
  if (!base) {
    const res = await fetch(getBaseStyleUrl(mode));
    base = (await res.json()) as maplibregl.StyleSpecification;
    rawStyleCache.set(mode, base);
  }

  const style: maplibregl.StyleSpecification = JSON.parse(JSON.stringify(base));
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  style.sources = {
    ...style.sources,
    "compliant-borders": {
      type: "geojson",
      data: `${origin}/geo/compliant-borders.json`,
    },
    "china-labels": {
      type: "geojson",
      data: `${origin}/geo/china-labels.json`,
    },
  };

  const isDark = mode === "dark";
  const fontStack = [
    "Montserrat SemiBold",
    "Open Sans Bold",
    "Noto Sans Regular",
    "Noto Sans CJK JP Regular",
  ];

  // Read native `place_state` paint so supplemental Chinese province/territory labels match native regions identically
  const nativeStateLayer = style.layers.find((l) => l.id === "place_state") as
    | maplibregl.SymbolLayerSpecification
    | undefined;

  const filteredLayers: maplibregl.LayerSpecification[] = [];

  for (const layer of style.layers) {
    const srcLayer = (layer as { "source-layer"?: string })["source-layer"];
    if (srcLayer === "boundaries" || layer.id.startsWith("boundary_")) {
      continue;
    }

    if (layer.type === "symbol" && (srcLayer === "places" || srcLayer === "water")) {
      const notDisputed: maplibregl.ExpressionSpecification = [
        "all",
        ["!", ["in", ["coalesce", ["get", "wikidata"], ""], ["literal", BLOCKED_WIKIDATA]]],
        ["!", ["in", ["coalesce", ["get", "name:en"], ""], ["literal", BLOCKED_DISPUTED_NAMES]]],
        ["!", ["in", ["coalesce", ["get", "name"], ""], ["literal", BLOCKED_DISPUTED_NAMES]]],
        ["!", ["in", ["coalesce", ["get", "name:zh"], ""], ["literal", BLOCKED_DISPUTED_NAMES]]],
        ["!", ["in", ["coalesce", ["get", "name:zh-Hans"], ""], ["literal", BLOCKED_DISPUTED_NAMES]]],
        ["!", ["in", ["coalesce", ["get", "name:zh-Hant"], ""], ["literal", BLOCKED_DISPUTED_NAMES]]],
      ];

      const notFalseCountry: maplibregl.ExpressionSpecification | null = layer.id.startsWith("place_country")
        ? [
            "all",
            ["!", ["in", ["coalesce", ["get", "name:en"], ""], ["literal", BLOCKED_AS_COUNTRY]]],
            ["!", ["in", ["coalesce", ["get", "name"], ""], ["literal", BLOCKED_AS_COUNTRY]]],
            ["!", ["in", ["coalesce", ["get", "name:zh"], ""], ["literal", BLOCKED_AS_COUNTRY]]],
            ["!", ["in", ["coalesce", ["get", "name:zh-Hans"], ""], ["literal", BLOCKED_AS_COUNTRY]]],
          ]
        : null;

      const existingFilter = (layer as { filter?: unknown }).filter;
      const mergedFilter: unknown[] = ["all"];
      if (existingFilter) mergedFilter.push(existingFilter);
      mergedFilter.push(notDisputed);
      if (notFalseCountry) mergedFilter.push(notFalseCountry);
      (layer as { filter?: unknown }).filter = mergedFilter;

      if (locale === "zh" && srcLayer === "places" && layer.layout?.["text-field"]) {
        layer.layout["text-field"] = [
          "coalesce",
          ["get", "name:zh-Hans"],
          ["get", "name:zh"],
          ["get", "name:en"],
          ["get", "name"],
        ];
      }
    }

    filteredLayers.push(layer);
  }

  // Land is `#0e0e0e` while Ocean is `#2C353C` in dark mode: match ΔL contrast (~+46) on each surface
  // so land borders on land and the Ten-Dash Line on ocean have identical perceived visual weight!
  const nationalBorderColor = isDark ? "#3a3f47" : "#cbd5e1";
  const maritimeDashColor = isDark ? "#5d6773" : "#94a3b8";
  const provinceBorderColor = isDark ? "#252930" : "#e2e8f0";
  const nationalBorderWidth: maplibregl.ExpressionSpecification = [
    "interpolate",
    ["linear"],
    ["zoom"],
    1,
    0.6,
    5,
    1.0,
    9,
    1.3,
  ];

  const firstSymbolIdx = filteredLayers.findIndex((l) => l.type === "symbol");
  const insertAt = firstSymbolIdx >= 0 ? firstSymbolIdx : filteredLayers.length;

  const borderLayers: maplibregl.LayerSpecification[] = [
    {
      id: "compliant-china-provinces",
      type: "line",
      source: "compliant-borders",
      minzoom: 6, // Same zoom threshold as native state/province borders globally
      filter: ["==", ["get", "role"], "china-province"],
      layout: { "line-cap": "butt", "line-join": "round" },
      paint: {
        "line-color": provinceBorderColor,
        "line-dasharray": [2, 2],
        "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.6, 8, 0.9],
      },
    },
    {
      id: "compliant-foreign-borders",
      type: "line",
      source: "compliant-borders",
      filter: ["==", ["get", "role"], "foreign-border"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": nationalBorderColor,
        "line-width": nationalBorderWidth,
      },
    },
    {
      id: "compliant-china-border",
      type: "line",
      source: "compliant-borders",
      filter: ["==", ["get", "role"], "china-land-border"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": nationalBorderColor,
        "line-width": nationalBorderWidth,
      },
    },
    {
      id: "compliant-china-dash-fill",
      type: "fill",
      source: "compliant-borders",
      filter: ["==", ["get", "role"], "china-dash"],
      paint: {
        "fill-color": maritimeDashColor,
      },
    },
    {
      id: "compliant-china-dash-line",
      type: "line",
      source: "compliant-borders",
      filter: ["==", ["get", "role"], "china-dash"],
      paint: {
        "line-color": maritimeDashColor,
        "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.9, 5, 1.35, 9, 1.7],
      },
    },
  ];

  const textFieldExpr: maplibregl.ExpressionSpecification =
    locale === "en" ? ["get", "en"] : ["get", "zh"];

  // Only supplement missing sovereign/provincial labels (Taiwan Province, Zangnan, SCS islands) at `minzoom: 5`
  // — matching native `place_state` (`minzoom: 5`, `maxzoom: 10`) so NO label ever appears earlier than other countries!
  const supplementalRegionLayers: maplibregl.LayerSpecification[] = [
    {
      id: "compliant-china-supplemental-labels",
      type: "symbol",
      source: "china-labels",
      minzoom: 5,
      maxzoom: 10,
      filter: [
        "any",
        ["==", ["get", "kind"], "sovereign"],
        ["==", ["get", "zh"], "台湾省"],
      ],
      layout: {
        "text-field": textFieldExpr,
        "text-font": fontStack,
        "text-size": ["interpolate", ["linear"], ["zoom"], 5, 11.5, 7, 13.5],
        "text-transform": "uppercase",
      },
      paint: nativeStateLayer?.paint ?? {
        "text-color": isDark ? "rgba(160, 170, 180, 0.85)" : "rgba(82, 94, 112, 0.85)",
        "text-halo-color": isDark ? "#111" : "#f8fafc",
        "text-halo-width": 1,
      },
    },
  ];

  filteredLayers.splice(insertAt, 0, ...borderLayers);
  filteredLayers.push(...supplementalRegionLayers);
  style.layers = filteredLayers;

  return style;
}
