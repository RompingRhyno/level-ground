/**
 * TEMPORARY audit — dumps the current R2 bucket's configuration and inventory so the new bucket can
 * be created to match (or improve on) it, instead of blindly copying.
 *
 * Read-only: ListBuckets, GetBucketLocation/Cors/Lifecycle, ListObjectsV2, HeadObject.
 *
 *   npx tsx scripts/tmp-r2-audit.ts
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

import {
  GetBucketCorsCommand,
  GetBucketLifecycleConfigurationCommand,
  GetBucketLocationCommand,
  HeadObjectCommand,
  ListBucketsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";

function makeClient(): S3Client {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const accountId = process.env.R2_ACCOUNT_ID;
  if (!accessKeyId || !secretAccessKey || !accountId) throw new Error("R2 env vars missing");
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: false,
  });
}

async function probe(label: string, fn: () => Promise<unknown>) {
  try {
    const result = await fn();
    console.log(`\n[${label}]`);
    console.log(JSON.stringify(result, null, 1));
  } catch (err: unknown) {
    const e = err as { name?: string; Code?: string; message?: string; $metadata?: { httpStatusCode?: number } };
    console.log(`\n[${label}] unavailable — ${e.name ?? e.Code ?? "error"} (http ${e.$metadata?.httpStatusCode ?? "?"})`);
  }
}

async function main() {
  const s3 = makeClient();
  const bucket = process.env.R2_BUCKET_NAME as string;

  console.log(`account: ${process.env.R2_ACCOUNT_ID} | bucket under audit: ${bucket}`);

  await probe("all buckets in account", async () => {
    const r = await s3.send(new ListBucketsCommand({}));
    return (r.Buckets ?? []).map((b) => ({ name: b.Name, created: b.CreationDate?.toISOString() }));
  });

  await probe("bucket location", () => s3.send(new GetBucketLocationCommand({ Bucket: bucket })));
  await probe("bucket CORS", () => s3.send(new GetBucketCorsCommand({ Bucket: bucket })));
  await probe("bucket lifecycle", () =>
    s3.send(new GetBucketLifecycleConfigurationCommand({ Bucket: bucket })),
  );

  // ── Inventory ────────────────────────────────────────────────────────────
  let token: string | undefined;
  let count = 0;
  let bytes = 0;
  const prefixes = new Map<string, { n: number; bytes: number }>();
  const largest: { key: string; size: number }[] = [];
  const samples: string[] = [];

  do {
    const page = await s3.send(
      new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token, MaxKeys: 1000 }),
    );
    for (const obj of page.Contents ?? []) {
      if (!obj.Key) continue;
      count++;
      const size = obj.Size ?? 0;
      bytes += size;

      // Two-level grouping: "media/<folder/" and "contact-uploads/" etc.
      const parts = obj.Key.split("/");
      const group =
        parts[0] === "media" && parts.length > 2 ? `media/${parts[1]}/` : `${parts[0]}/`;
      const entry = prefixes.get(group) ?? { n: 0, bytes: 0 };
      entry.n++;
      entry.bytes += size;
      prefixes.set(group, entry);

      largest.push({ key: obj.Key, size });
      if (samples.length < 6 && obj.Key.includes(".")) samples.push(obj.Key);
    }
    token = page.NextContinuationToken;
  } while (token);

  console.log(`\n[inventory] ${count} objects, ${(bytes / 1024 / 1024).toFixed(1)} MB total`);
  for (const [group, entry] of [...prefixes.entries()].sort((a, b) => b[1].bytes - a[1].bytes)) {
    console.log(`  ${group.padEnd(34)} ${String(entry.n).padStart(5)} obj  ${(entry.bytes / 1024 / 1024).toFixed(1).padStart(9)} MB`);
  }

  largest.sort((a, b) => b.size - a.size);
  console.log("\n[largest 5]");
  for (const l of largest.slice(0, 5)) {
    console.log(`  ${(l.size / 1024 / 1024).toFixed(2).padStart(7)} MB  ${l.key}`);
  }

  // ── Object metadata on a few samples ────────────────────────────────────
  console.log("\n[sample object metadata]");
  const picks = [
    ...samples.slice(0, 3),
    ...largest.slice(0, 2).map((l) => l.key),
    // exercise the contact-upload prefix too, if anything is left there
    ...(prefixes.has("contact-uploads/") ? [largest[0]?.key].filter(Boolean) : []),
  ];
  for (const key of [...new Set(picks)]) {
    try {
      const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      console.log(
        `  ${key}\n    contentType=${head.ContentType} cacheControl=${head.CacheControl ?? "(none)"} ` +
          `contentLength=${head.ContentLength} metadata=${JSON.stringify(head.Metadata ?? {})}`,
      );
    } catch (err) {
      console.log(`  ${key}\n    HEAD failed: ${(err as Error).name}`);
    }
  }
}

main().catch((err) => {
  console.error("audit failed:", err);
  process.exit(1);
});
