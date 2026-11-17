import ExifReader from "exifreader";

export interface ExtractedExif {
  width?: number;
  height?: number;
  camera: string;
  lens: string;
  focalMm: number | null;
  aperture: string;
  shutter: string;
  iso: number | null;
  takenAt: string;
  lat: number | null;
  lng: number | null;
}

function cleanCameraName(make?: string, model?: string): string {
  const m = (model || "").trim();
  const mk = (make || "").trim().replace(/\s*(Camera AG|Corporation|Co\.,\s*Ltd\.?|Inc\.?)$/i, "");
  if (!m) return mk;
  if (!mk || m.toLowerCase().startsWith(mk.toLowerCase())) return m;
  return `${mk} ${m}`;
}

export function extractExifFromBuffer(buffer: Buffer): ExtractedExif {
  try {
    const tags = ExifReader.load(buffer, { expanded: true });
    const exif = (tags.exif || {}) as Record<string, { description?: string; value?: unknown }>;
    const file = (tags.file || {}) as Record<string, { description?: string; value?: unknown }>;
    const gps = tags.gps || {};

    const width = Number(file["Image Width"]?.value || exif.PixelXDimension?.value || 0) || undefined;
    const height = Number(file["Image Height"]?.value || exif.PixelYDimension?.value || 0) || undefined;

    const camera = cleanCameraName(exif.Make?.description, exif.Model?.description);
    const lens = (exif.LensModel?.description || "").trim();

    const focalRaw =
      exif.FocalLengthIn35mmFilm?.description || exif.FocalLength?.description || "";
    const focalMatch = String(focalRaw).match(/(\d+(?:\.\d+)?)/);
    const focalMm = focalMatch ? Math.round(Number(focalMatch[1])) : null;

    let aperture = (exif.FNumber?.description || "").trim();
    if (aperture && !aperture.startsWith("f/")) {
      const num = aperture.replace(/^F/i, "");
      if (num) aperture = `f/${num}`;
    }

    let shutter = (exif.ExposureTime?.description || "").trim();
    if (shutter && !shutter.endsWith("s")) shutter = `${shutter}s`;

    const isoVal = Number(exif.ISOSpeedRatings?.description || exif.PhotographicSensitivity?.description || 0);
    const iso = isoVal > 0 ? isoVal : null;

    let takenAt = "";
    const rawDate = exif.DateTimeOriginal?.description || exif.CreateDate?.description || "";
    const dateMatch = String(rawDate).match(/^(\d{4})[:-](\d{2})[:-](\d{2})/);
    if (dateMatch) takenAt = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;

    const lat = typeof gps.Latitude === "number" && !Number.isNaN(gps.Latitude) ? gps.Latitude : null;
    const lng = typeof gps.Longitude === "number" && !Number.isNaN(gps.Longitude) ? gps.Longitude : null;

    return { width, height, camera, lens, focalMm, aperture, shutter, iso, takenAt, lat, lng };
  } catch {
    return {
      camera: "",
      lens: "",
      focalMm: null,
      aperture: "",
      shutter: "",
      iso: null,
      takenAt: "",
      lat: null,
      lng: null,
    };
  }
}
