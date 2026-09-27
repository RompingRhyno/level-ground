import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

/** Cloudflare R2 client built from env, or null when credentials are missing. */
export function r2Client(): { client: S3Client; bucket: string } | null {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET_NAME;

  if (!accessKeyId || !secretAccessKey || !accountId || !bucket) return null;

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: false,
  });
  return { client, bucket };
}

export type DeleteObjectsResult = { deleted: number; failed: string[] };

/**
 * Delete R2 objects. Failures are collected rather than thrown: a missing object or a transient
 * error should not block the database cleanup (mirrors the contact-upload cleanup semantics).
 */
export async function deleteR2Objects(keys: string[]): Promise<DeleteObjectsResult> {
  const unique = [...new Set(keys.filter(Boolean))];
  const target = r2Client();
  if (!target || !unique.length) return { deleted: 0, failed: unique };

  let deleted = 0;
  const failed: string[] = [];
  for (const key of unique) {
    try {
      await target.client.send(new DeleteObjectCommand({ Bucket: target.bucket, Key: key }) as any);
      deleted++;
    } catch (err) {
      console.warn("[r2] delete failed", key, err);
      failed.push(key);
    }
  }
  return { deleted, failed };
}

/** Public URL for a storage key (used when recording variants/posters). */
export function r2PublicUrlFor(key: string): string | null {
  const base = process.env.R2_BASE_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/${key}`;
}

/**
 * Every R2 object key an asset's `meta` refers to.
 *
 * A video upload writes one object per rendition plus a poster, and records only their public URLs
 * (`meta.variants.{720p,1080p}`, `meta.poster`), while the poster backfill also stored an explicit
 * `*Key` field. Deleting just `Asset.storageKey` therefore left the 720p rendition and the poster
 * behind in the bucket forever — collect them here so delete paths can remove the whole set.
 */
export function r2KeysFromMeta(meta: unknown): string[] {
  const base = (process.env.R2_BASE_URL || "").replace(/\/$/, "");
  const keys = new Set<string>();

  const keyFromUrl = (url: string): string | null => {
    if (base && url.startsWith(`${base}/`)) return url.slice(base.length + 1);
    // Renditions and posters live under `media/<folder>/…`, so the key can be recovered from the path
    // alone — which keeps this working when the r2.dev publish domain is replaced by a custom domain.
    const marker = url.indexOf("/media/");
    return marker === -1 ? null : url.slice(marker + 1);
  };

  const visit = (node: unknown, field = "") => {
    if (typeof node === "string") {
      if (/^https?:\/\//.test(node)) {
        const key = keyFromUrl(node);
        if (key) keys.add(key);
      } else if (node && /Key$/.test(field)) {
        keys.add(node);
      }
      return;
    }
    if (Array.isArray(node)) {
      for (const entry of node) visit(entry, field);
      return;
    }
    if (node && typeof node === "object") {
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) visit(value, key);
    }
  };

  visit(meta);
  return [...keys].filter(Boolean);
}
