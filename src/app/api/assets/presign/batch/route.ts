import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, r2PublicUrlFor } from "@/lib/r2";
import { ALLOWED_UPLOAD_MIME_TYPES, MEDIA_CACHE_CONTROL, isAllowedUploadMime, isClientConvertedMime, storageKeyFor } from "@/lib/mime";
import { requireSession, unauthorized } from "@/lib/api-auth";

/**
 * Batch presign for admin uploads. One request per upload batch; each file gets a
 * `media/<folderSlug>/<timestamp>-<filename>` key.
 *
 * The folder is required: every asset in the library belongs to a project folder.
 */
export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

  const body = await request.json().catch(() => null);
  const { files, folder } = (body ?? {}) as { files?: any[]; folder?: string };

  if (!Array.isArray(files) || files.length === 0) {
    return NextResponse.json({ error: "missing files array" }, { status: 400 });
  }

  const folderSlug = typeof folder === "string" ? folder.trim() : "";
  if (!folderSlug) {
    return NextResponse.json({ error: "FOLDER_REQUIRED", message: "Choose a folder before uploading." }, { status: 400 });
  }

  const folderRow = await prisma.folder.findUnique({ where: { slug: folderSlug }, select: { id: true } });
  if (!folderRow) {
    return NextResponse.json({ error: "UNKNOWN_FOLDER", message: `No folder with slug "${folderSlug}".` }, { status: 400 });
  }

  const target = r2Client();
  if (!target) {
    return NextResponse.json({ error: "R2 credentials not configured" }, { status: 500 });
  }

  const results: Array<{ filename: string; key: string; url: string; publicUrl: string | null }> = [];

  for (const file of files) {
    const filename = typeof file?.filename === "string" ? file.filename : "";
    const contentType = typeof file?.contentType === "string" ? file.contentType : "";
    if (!filename) continue;

    if (isClientConvertedMime(contentType)) {
      return NextResponse.json(
        { error: "CONVERT_IN_BROWSER", message: `${filename}: HEIC/HEIF must be converted to JPEG before upload.` },
        { status: 400 },
      );
    }
    if (contentType && !isAllowedUploadMime(contentType)) {
      return NextResponse.json(
        { error: "UNSUPPORTED_MEDIA_TYPE", message: `${filename}: ${contentType || "unknown type"} is not supported. Allowed: ${ALLOWED_UPLOAD_MIME_TYPES.join(", ")}` },
        { status: 415 },
      );
    }

    const key = storageKeyFor(folderSlug, filename);
    const cmd = new PutObjectCommand({
      Bucket: target.bucket,
      Key: key,
      ContentType: contentType || "application/octet-stream",
      // Not part of the signature — R2 stores it only when the browser actually sends the header,
      // which the upload clients do via uploadWithProgress's extraHeaders.
      CacheControl: MEDIA_CACHE_CONTROL,
    });
    const url = await getSignedUrl(target.client as any, cmd as any, { expiresIn: 3600 });

    results.push({ filename, key, url, publicUrl: r2PublicUrlFor(key) });
  }

  return NextResponse.json({ folder: folderSlug, results });
}
