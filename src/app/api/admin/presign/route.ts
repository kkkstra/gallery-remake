import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { createPresignedUpload } from "@/lib/storage";

export async function POST(req: Request) {
  if (!(await isAdminAuthenticated(req))) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { filename, contentType } = await req.json();
  if (!filename) {
    return NextResponse.json({ error: "缺少文件名" }, { status: 400 });
  }

  const presigned = await createPresignedUpload(String(filename), String(contentType || "image/jpeg"));
  if (!presigned) {
    return NextResponse.json({ error: "当前未启用 S3/R2 存储" }, { status: 400 });
  }

  return NextResponse.json(presigned);
}
