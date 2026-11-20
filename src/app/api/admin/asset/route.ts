import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { storeUploadedFile } from "@/lib/storage";

export async function POST(req: Request) {
  if (!(await isAdminAuthenticated(req))) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "缺少图片文件" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const url = await storeUploadedFile(
    buffer,
    file.name || "brand-asset.png",
    file.type || "image/png"
  );

  return NextResponse.json({ url });
}
