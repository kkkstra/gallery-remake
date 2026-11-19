import fs from "node:fs";
import { ImageResponse } from "next/og";
import sharp, { type OverlayOptions } from "sharp";
import { getAllPhotos, getSiteSettings } from "@/lib/queries";
import { resolveLocalPhotoPath } from "@/lib/lqip";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

function escXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function fetchGoogleFontSubset(text: string): Promise<ArrayBuffer | null> {
  try {
    const uniqueChars = Array.from(new Set(text)).join("");
    const cssUrl = `https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@600&text=${encodeURIComponent(uniqueChars)}`;
    const cssRes = await fetch(cssUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    const css = await cssRes.text();
    const match = css.match(/src:\s*url\(([^)]+)\)\s*format\(['"](?:woff2|truetype|opentype)['"]\)/) ||
      css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/);
    if (!match?.[1]) return null;
    const fontRes = await fetch(match[1]);
    return fontRes.ok ? await fontRes.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = Number((await params).id);
  const [allPhotos, settings] = await Promise.all([
    getAllPhotos(),
    getSiteSettings(),
  ]);
  const photo = allPhotos.find((p) => p.id === id) ?? null;

  const W = 1200;
  const H = 630;
  const author = [settings.photographerName || "林远", settings.photographerNameEn]
    .filter(Boolean)
    .join(" · ");

  const title = photo?.title || settings.photographerName || "Photography";
  const subtitle = photo?.titleEn || "";
  const place = [photo?.location, photo?.takenAt].filter(Boolean).join("  ·  ");
  const gear = photo?.camera || "";
  const specs = [
    photo?.focalMm ? `${photo.focalMm}mm` : "",
    photo?.aperture || "",
    photo?.shutter || "",
    photo?.iso ? `ISO ${photo.iso}` : "",
  ]
    .filter(Boolean)
    .join("  ");

  // On Vercel Serverless (where OS CJK fonts are absent), render via `next/og` ImageResponse + dynamic 4KB Noto Sans SC subset
  if (process.env.VERCEL) {
    let imgSrc = photo?.url || "";
    if (photo && !imgSrc.startsWith("http")) {
      const localPath = resolveLocalPhotoPath(photo.url);
      if (localPath && fs.existsSync(localPath)) {
        const resized = await sharp(localPath).rotate().resize(760, 540, { fit: "inside" }).jpeg({ quality: 82 }).toBuffer();
        imgSrc = `data:image/jpeg;base64,${resized.toString("base64")}`;
      }
    }

    const allText = `${author}${title}${subtitle}${place}${gear}${specs}`;
    const fontData = await fetchGoogleFontSubset(allText);

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#0b0d12",
            color: "#F4F5F7",
            padding: "52px 58px",
            fontFamily: fontData ? "NotoSansSC" : "sans-serif",
          }}
        >
          <div
            style={{
              width: "660px",
              height: "526px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {imgSrc ? (
              <img
                src={imgSrc}
                alt=""
                style={{ maxWidth: "660px", maxHeight: "526px", objectFit: "contain" }}
              />
            ) : null}
          </div>

          <div
            style={{
              width: "380px",
              height: "480px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              borderLeft: "1px solid rgba(255,255,255,0.14)",
              paddingLeft: "36px",
            }}
          >
            <div style={{ fontSize: 15, color: "rgba(255,255,255,0.52)", letterSpacing: "2px", marginBottom: 42 }}>
              {author.toUpperCase()}
            </div>
            <div style={{ fontSize: 36, fontWeight: 600, lineHeight: 1.25 }}>{title}</div>
            {subtitle ? (
              <div style={{ fontSize: 19, color: "rgba(255,255,255,0.64)", marginTop: 8 }}>{subtitle}</div>
            ) : null}
            {place ? (
              <div style={{ fontSize: 17, color: "rgba(255,255,255,0.72)", marginTop: 28 }}>{place}</div>
            ) : null}
            {gear ? (
              <div style={{ display: "flex", alignItems: "center", marginTop: 52 }}>
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    backgroundColor: "#E20613",
                    marginRight: 10,
                  }}
                />
                <span style={{ fontSize: 20, fontWeight: 600 }}>{gear}</span>
              </div>
            ) : null}
            {specs ? (
              <div style={{ fontSize: 16, color: "rgba(255,255,255,0.62)", marginTop: 8 }}>{specs}</div>
            ) : null}
          </div>
        </div>
      ),
      {
        ...size,
        fonts: fontData
          ? [{ name: "NotoSansSC", data: fontData, style: "normal", weight: 600 }]
          : undefined,
      }
    );
  }

  // Local / VPS Node runtime with native sharp + system CJK fonts
  const composites: OverlayOptions[] = [];

  if (photo) {
    try {
      const localPath = resolveLocalPhotoPath(photo.url);
      let sourceBuf: Buffer | null = null;
      if (localPath) {
        sourceBuf = await sharp(localPath).rotate().toBuffer();
      } else if (photo.url.startsWith("http")) {
        const res = await fetch(photo.url);
        if (res.ok) sourceBuf = Buffer.from(await res.arrayBuffer());
      }

      if (sourceBuf) {
        const bgBlur = await sharp(sourceBuf)
          .resize(W, H, { fit: "cover" })
          .blur(42)
          .modulate({ brightness: 0.32, saturation: 1.25 })
          .toBuffer();
        composites.push({ input: bgBlur, left: 0, top: 0 });

        const boxW = 680;
        const boxH = 526;
        const fitted = await sharp(sourceBuf)
          .resize(boxW, boxH, { fit: "inside", withoutEnlargement: true })
          .toBuffer({ resolveWithObject: true });

        const imgLeft = 52 + Math.round((boxW - fitted.info.width) / 2);
        const imgTop = Math.round((H - fitted.info.height) / 2);
        composites.push({ input: fitted.data, left: imgLeft, top: imgTop });
      }
    } catch {
      // Fallback to dark card
    }
  }

  const svg = `
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="panel" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#0b0d12" stop-opacity="0.15"/>
          <stop offset="56%" stop-color="#0b0d12" stop-opacity="0.82"/>
          <stop offset="100%" stop-color="#0b0d12" stop-opacity="0.96"/>
        </linearGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#panel)"/>
      <line x1="776" y1="74" x2="776" y2="${H - 74}" stroke="rgba(255,255,255,0.14)" stroke-width="1"/>

      <text x="812" y="132" fill="rgba(255,255,255,0.52)" font-size="15" font-family="PingFang SC, Noto Sans CJK SC, sans-serif" letter-spacing="2">
        ${escXml(author.toUpperCase())}
      </text>

      <text x="812" y="246" fill="#F4F5F7" font-size="38" font-weight="600" font-family="PingFang SC, Noto Sans CJK SC, sans-serif">
        ${escXml(title.slice(0, 14))}
      </text>
      ${
        subtitle
          ? `<text x="812" y="286" fill="rgba(255,255,255,0.64)" font-size="20" font-family="PingFang SC, Noto Sans CJK SC, sans-serif">${escXml(subtitle.slice(0, 26))}</text>`
          : ""
      }

      ${
        place
          ? `<text x="812" y="352" fill="rgba(255,255,255,0.72)" font-size="18" font-family="PingFang SC, Noto Sans CJK SC, sans-serif">${escXml(place)}</text>`
          : ""
      }

      ${
        gear
          ? `<circle cx="820" cy="458" r="5" fill="#E20613"/>
             <text x="836" y="464" fill="#F4F5F7" font-size="20" font-weight="600" font-family="PingFang SC, Noto Sans CJK SC, sans-serif">${escXml(gear)}</text>`
          : ""
      }
      ${
        specs
          ? `<text x="812" y="498" fill="rgba(255,255,255,0.62)" font-size="17" font-family="PingFang SC, Noto Sans CJK SC, sans-serif">${escXml(specs)}</text>`
          : ""
      }
    </svg>
  `;

  composites.push({ input: Buffer.from(svg), left: 0, top: 0 });

  const png = await sharp({
    create: {
      width: W,
      height: H,
      channels: 4,
      background: { r: 11, g: 13, b: 18, alpha: 1 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
