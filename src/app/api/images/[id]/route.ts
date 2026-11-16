import { connection } from "next/server";
import { db } from "@/lib/db";
import { readFoodImage } from "@/server/admin/images";

/** GET /api/images/<id> — an uploaded product photo. Ids are random; files are never addressed by path. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const image = /^[a-z0-9]{1,40}$/.test(id) ? await readFoodImage(db, id) : null;
  if (!image) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.mimeType,
      "Content-Length": String(image.data.length),
      // An image id always refers to the same bytes.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
