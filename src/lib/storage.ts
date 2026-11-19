import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const LOCAL_UPLOAD_DIR = process.env.VERCEL
  ? path.join("/tmp", "gallery-data", "uploads")
  : path.join(process.cwd(), "data", "uploads");

export function getStorageMode(): "s3" | "local" {
  return process.env.S3_BUCKET &&
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY &&
    process.env.S3_PUBLIC_URL
    ? "s3"
    : "local";
}

function createS3Client() {
  return new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });
}

function makePhotoKey(originalName: string): { filename: string; key: string } {
  const ext = (path.extname(originalName) || ".jpg").toLowerCase().replace(/[^.a-z0-9]/g, "") || ".jpg";
  const filename = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
  return { filename, key: `photos/${filename}` };
}

export async function createPresignedUpload(originalName: string, contentType: string) {
  if (getStorageMode() !== "s3") return null;
  const { key } = makePhotoKey(originalName);
  const client = createS3Client();
  const cmd = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: key,
    ContentType: contentType || "image/jpeg",
  });
  const uploadUrl = await getSignedUrl(client, cmd, { expiresIn: 900 });
  const publicUrl = `${process.env.S3_PUBLIC_URL!.replace(/\/$/, "")}/${key}`;
  return { uploadUrl, publicUrl, key };
}

export async function storeUploadedFile(
  buffer: Buffer,
  originalName: string,
  contentType: string
): Promise<string> {
  const { filename, key } = makePhotoKey(originalName);

  if (getStorageMode() === "s3") {
    const client = createS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: key,
        Body: buffer,
        ContentType: contentType || "image/jpeg",
      })
    );
    return `${process.env.S3_PUBLIC_URL!.replace(/\/$/, "")}/${key}`;
  }

  await fs.mkdir(LOCAL_UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(LOCAL_UPLOAD_DIR, filename), buffer);
  return `/uploads/${filename}`;
}
