import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import { dataDir, sessionUser, rateLimit } from "@/lib/db";
import { HttpError, assert, checkOrigin, requireUser } from "@/lib/validation";
export const runtime = "nodejs";
export async function POST(req) {
  try {
    checkOrigin(req);
    const user = requireUser(
      sessionUser((await cookies()).get("session")?.value),
    );
    assert(
      rateLimit("upload:" + user.id, 100, 3600_000),
      "Слишком много загрузок",
      429,
    );
    const length = Number(req.headers.get("content-length") || 0);
    assert(
      length > 0 && length <= 5_500_000,
      "Файл слишком большой или размер не указан",
      413,
    );
    const form = await req.formData();
    const file = form.get("file");
    assert(
      file &&
        typeof file.arrayBuffer === "function" &&
        file.size > 0 &&
        file.size <= 5_000_000,
      "Выберите изображение размером до 5 МБ",
    );
    const bytes = Buffer.from(await file.arrayBuffer());
    const input = sharp(bytes, {
      limitInputPixels: 20_000_000,
      failOn: "error",
    });
    const metadata = await input.metadata();
    assert(
      ["jpeg", "png", "webp"].includes(metadata.format),
      "Поддерживаются JPEG, PNG и WebP",
    );
    const image = await input
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();
    const name = randomBytes(16).toString("hex") + ".webp";
    const dir = path.join(dataDir, "uploads");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), image, { flag: "wx" });
    return NextResponse.json({ url: "/media/" + name });
  } catch (error) {
    if (error instanceof HttpError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    console.error("Upload error:", error.message);
    return NextResponse.json(
      { error: "Не удалось обработать изображение" },
      { status: 400 },
    );
  }
}
