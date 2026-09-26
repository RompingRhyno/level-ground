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
