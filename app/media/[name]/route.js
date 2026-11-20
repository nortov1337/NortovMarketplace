import { readFile } from "node:fs/promises";
import path from "node:path";
import { dataDir } from "@/lib/db";
export const runtime = "nodejs";
export async function GET(req, context) {
  const { name } = await context.params;
  if (!/^[a-f0-9]{32}\.webp$/.test(name))
    return new Response(null, { status: 404 });
  try {
    const file = await readFile(path.join(dataDir, "uploads", name));
    return new Response(file, {
      headers: {
        "Content-Type": "image/webp",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
