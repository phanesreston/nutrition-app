import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { uploadedImageUrl } from "@/food-sources/merge";
import { getAdmin } from "@/server/admin/auth";
import { ImageRejected, MAX_UPLOAD_BYTES, storeFoodImage } from "@/server/admin/images";

/**
 * POST /api/admin/foods/<id>/image  (multipart form, field "file")
 * Stores a new product photo and returns its id. It does not change which
 * photo the product uses — that happens when the editor is saved.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "You are not signed in as an administrator" }, { status: 401 });

  // Refuse cross-site form posts outright (the session cookie is SameSite=Lax as well).
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) {
    return NextResponse.json({ ok: false, error: "Cross-site request refused" }, { status: 403 });
  }

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) {
    return NextResponse.json({ ok: false, error: "The image is larger than 8 MB" }, { status: 413 });
  }

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return NextResponse.json({ ok: false, error: "No image was received" }, { status: 400 });
  }
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "No image was received" }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ ok: false, error: "The image is larger than 8 MB" }, { status: 413 });

  const { id } = await params;
  try {
    const imageId = await storeFoodImage(db, admin.id, id, new Uint8Array(await file.arrayBuffer()));
    return NextResponse.json({ ok: true, imageId, url: uploadedImageUrl(imageId) });
  } catch (error) {
    if (error instanceof ImageRejected) return NextResponse.json({ ok: false, error: error.message }, { status: 422 });
    console.error("Image upload failed", error);
    return NextResponse.json({ ok: false, error: "The image could not be saved" }, { status: 500 });
  }
}
