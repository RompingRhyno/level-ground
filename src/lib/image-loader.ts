/**
 * next/image loader → Cloudflare Image Transformations on the R2 custom domain.
 *
 * Media lives under `/media/...` on `assets.levelgroundlandscape.com`, which is the same zone that
 * serves transformations, so the optimizer URL is just the source path behind `/cdn-cgi/image/…`.
 *
 * Two deliberate details:
 *  - `format=auto` lets Cloudflare pick AVIF/WebP from the Accept header; `quality` is ours.
 *  - `onerror=redirect` makes an over-quota or failed transform fall back to the original file
 *    instead of returning the 9422 error — the difference between a slow image and a broken one.
 *
 * `format` and `quality` are excluded from Cloudflare's "unique transformation" billing, so the
 * quality tiers cost nothing; only width (and any other parameter) counts.
 *
 * Anything that is not on the media host — the local logo, or legacy r2.dev URLs before the stored
 * URLs are rewritten — is returned untouched, so this loader can ship before the DB rewrite without
 * breaking the live site. The host comes from NEXT_PUBLIC_MEDIA_HOST (inlined at build, identical in
 * the server and client bundles, so the srcsets match); the production host is the default.
 */
const MEDIA_HOST = (process.env.NEXT_PUBLIC_MEDIA_HOST || "assets.levelgroundlandscape.com").trim();

export default function mediaLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return src; // relative path (local public asset)
  }
  if (url.hostname !== MEDIA_HOST) return src;

  const params = `width=${width},quality=${quality ?? 75},format=auto,onerror=redirect`;
  return `${url.origin}/cdn-cgi/image/${params}${url.pathname}`;
}
