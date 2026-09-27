/** Shared media type rules for uploads, storage keys and rendering. */

export const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
] as const;

export const VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/ogg",
] as const;

/** Converted in the browser before upload (never accepted by the API). */
export const CLIENT_CONVERTED_MIME_TYPES = ["image/heic", "image/heif"] as const;

const IMAGE_SET = new Set<string>(IMAGE_MIME_TYPES);
const VIDEO_SET = new Set<string>(VIDEO_MIME_TYPES);
const CONVERTED_SET = new Set<string>(CLIENT_CONVERTED_MIME_TYPES);

export const ALLOWED_UPLOAD_MIME_TYPES = [...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES];

export function isImageMime(mime?: string | null): boolean {
  return !!mime && IMAGE_SET.has(mime);
}

export function isVideoMime(mime?: string | null): boolean {
  return !!mime && VIDEO_SET.has(mime);
}

export function isClientConvertedMime(mime?: string | null): boolean {
  return !!mime && CONVERTED_SET.has(mime);
}

export function isAllowedUploadMime(mime?: string | null): boolean {
  return isImageMime(mime) || isVideoMime(mime);
}

/** Filename with directory separators and unsafe characters removed (mirrors the contact flow). */
export function sanitiseFilename(name: string): string {
  const base = (name || "file")
    .replace(/^.*[\\/]/, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/\.{2,}/g, ".")
    .replace(/^[-.]+/, "")
    .slice(0, 100);
  return base || "file";
}

/**
 * Storage key for an admin upload. Keeps assets namespaced under `media/<folderSlug>/` with a
 * timestamp prefix so repeated uploads of the same filename never collide.
 */
export function storageKeyFor(folderSlug: string, filename: string, timestamp = Date.now()): string {
  const folder = folderSlug.replace(/^\/+|\/+$/g, "") || "unsorted";
  return `media/${folder}/${timestamp}-${sanitiseFilename(filename)}`;
}

/**
 * Cache-Control for media objects. Keys are timestamped and never overwritten, so a year-long
 * immutable lifetime is safe and removes repeat downloads entirely.
 *
 * Verified against the live bucket: the presigned PUT URL does *not* carry this value (aws-sdk signs
 * only `host`), so the browser upload must send it as a request header — both upload call sites pass
 * it through `uploadWithProgress`'s extraHeaders. A caller that omits it stores the object with no
 * cache-control at all, silently rather than with an error.
 */
export const MEDIA_CACHE_CONTROL = "public, max-age=31536000, immutable";

/** Mime type implied by a filename extension (used for generated variants/posters). */
export function mimeFromFilename(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf(".") + 1).toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "avif":
      return "image/avif";
    case "gif":
      return "image/gif";
    case "mp4":
      return "video/mp4";
    case "webm":
      return "video/webm";
    case "ogg":
    case "ogv":
      return "video/ogg";
    default:
      return "application/octet-stream";
  }
}
