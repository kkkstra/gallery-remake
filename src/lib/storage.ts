import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export const LOCAL_UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

export function getStorageMode(): "s3" | "local" {
  return process.env.S3_BUCKET &&
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY &&
    process.env.S3_PUBLIC_URL
    ? "s3"
    : "local";
}

export async function storeUploadedFile(
  buffer: Buffer,
  originalName: string,
  contentType: string
): Promise<string> {
  const ext = (path.extname(originalName) || ".jpg").toLowerCase().replace(/[^.a-z0-9]/g, "") || ".jpg";
  const filename = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;

  if (getStorageMode() === "s3") {
    const client = new S3Client({
      region: process.env.S3_REGION || "auto",
      endpoint: process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
    });
    const key = `photos/${filename}`;
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
