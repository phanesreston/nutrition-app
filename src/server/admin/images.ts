import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp, { type Metadata } from "sharp";
import type { PrismaClient } from "@prisma/client";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MIN_DIMENSION = 100;
const MAX_DIMENSION = 10_000;
const OUTPUT_MAX_SIDE = 1200;

/**
 * Where uploaded photos are kept. Set UPLOAD_DIR to a persistent folder
 * outside the web root; the default is ./storage/uploads under the app.
 * Files are only ever served through /api/images/<id>, never by path.
 */
export function uploadDir(env: Record<string, string | undefined> = process.env): string {
  return path.resolve(env.UPLOAD_DIR?.trim() || path.join(/* turbopackIgnore: true */ process.cwd(), "storage", "uploads"));
}

type Sniffed = "jpeg" | "png" | "webp";

/** Identify the real file type from its leading bytes, ignoring the name and the declared type. */
export function sniffImageType(data: Uint8Array): Sniffed | null {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "jpeg";
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (data.length >= 8 && png.every((b, i) => data[i] === b)) return "png";
  const ascii = (from: number, text: string) => [...text].every((c, i) => data[from + i] === c.charCodeAt(0));
  if (data.length >= 12 && ascii(0, "RIFF") && ascii(8, "WEBP")) return "webp";
  return null;
}

export class ImageRejected extends Error {}

export interface ProcessedImage {
  data: Buffer;
  width: number;
  height: number;
  mimeType: "image/webp";
}

/**
 * Validate an uploaded file and re-encode it. Re-encoding guarantees the
 * stored bytes are a plain image (whatever was uploaded), caps its size,
 * applies the camera's rotation, and drops metadata such as GPS location.
 */
export async function processUpload(input: Uint8Array): Promise<ProcessedImage> {
  if (input.length === 0) throw new ImageRejected("The file is empty");
  if (input.length > MAX_UPLOAD_BYTES) throw new ImageRejected("The image is larger than 8 MB");
  const sniffed = sniffImageType(input);
  if (!sniffed) throw new ImageRejected("Only JPG, PNG and WebP images are accepted");

  let meta: Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: 50_000_000, failOn: "error" }).metadata();
  } catch {
    throw new ImageRejected("The file is not a readable image");
  }
  if (meta.format !== sniffed) throw new ImageRejected("The file is not a readable image");
  const { width = 0, height = 0 } = meta;
  if (Math.min(width, height) < MIN_DIMENSION) throw new ImageRejected(`The image must be at least ${MIN_DIMENSION} pixels on each side`);
  if (Math.max(width, height) > MAX_DIMENSION) throw new ImageRejected(`The image must be at most ${MAX_DIMENSION} pixels on each side`);

  try {
    const { data, info } = await sharp(input, { limitInputPixels: 50_000_000, failOn: "error" })
      .rotate() // honour EXIF orientation before the metadata is dropped
      .resize({ width: OUTPUT_MAX_SIDE, height: OUTPUT_MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height, mimeType: "image/webp" };
  } catch {
    throw new ImageRejected("The file is not a readable image");
  }
}

/** Validate, store and register an uploaded product photo. Returns the new image's id. */
export async function storeFoodImage(prisma: PrismaClient, adminId: string, foodId: string, input: Uint8Array): Promise<string> {
  const food = await prisma.food.findUnique({ where: { id: foodId }, select: { id: true } });
  if (!food) throw new ImageRejected("That food no longer exists");
  const image = await processUpload(input);

  const dir = uploadDir();
  await mkdir(dir, { recursive: true });
  const filename = `${randomUUID()}.webp`; // generated: nothing from the upload reaches the filesystem path
  const file = path.join(dir, filename);
  await writeFile(file, image.data, { flag: "wx", mode: 0o640 });
  try {
    const row = await prisma.foodImage.create({
      data: { foodId, filename, mimeType: image.mimeType, width: image.width, height: image.height, bytes: image.data.length, uploadedBy: adminId },
    });
    return row.id;
  } catch (error) {
    await unlink(file).catch(() => {});
    throw error;
  }
}

/** Bytes and type of a stored image, or null if it does not exist. */
export async function readFoodImage(prisma: PrismaClient, imageId: string): Promise<{ data: Buffer; mimeType: string } | null> {
  const row = await prisma.foodImage.findUnique({ where: { id: imageId } });
  if (!row) return null;
  try {
    // basename() is belt and braces: filenames are generated, never user input.
    return { data: await readFile(path.join(/* turbopackIgnore: true */ uploadDir(), path.basename(row.filename))), mimeType: row.mimeType };
  } catch {
    return null;
  }
}
