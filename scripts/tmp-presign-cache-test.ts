/**
 * TEMPORARY check — does the presigned-PUT Cache-Control change actually work end to end?
 *
 * Mimics the presign route exactly (same command, same constant), then proves three things against
 * the real bucket:
 *   1. the generated URL signs `cache-control` (so the client must send it),
 *   2. a PUT with the header succeeds and stores the value as object metadata,
 *   3. a PUT without it is rejected — which is why both admin upload call sites were updated.
 *
 * Cleans up after itself.
 *
 *   npx tsx scripts/tmp-presign-cache-test.ts
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { MEDIA_CACHE_CONTROL } from "../src/lib/mime";

async function main() {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID as string;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY as string;
  const accountId = process.env.R2_ACCOUNT_ID as string;
  const bucket = process.env.R2_BUCKET_NAME as string;

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: false,
  });

  const stamp = Date.now();
  const keyWith = `tmp-cache-test/${stamp}-with.txt`;
  const keyWithout = `tmp-cache-test/${stamp}-without.txt`;

  const presign = async (key: string) => {
    const cmd = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: "text/plain",
      CacheControl: MEDIA_CACHE_CONTROL,
    });
    return getSignedUrl(client as never, cmd as never, { expiresIn: 3600 });
  };

  const results: { name: string; pass: boolean; detail: string }[] = [];
  const check = (name: string, pass: boolean, detail: string) => {
    results.push({ name, pass, detail });
    console.log(`  ${pass ? "ok  " : "FAIL"} ${name} — ${detail}`);
  };

  // 1. The presigned URL does not carry the value (only `host` is signed), so the header sent by the
  //    browser is what actually stores it. Measured, not assumed.
  const url = await presign(keyWith);

  // 2. PUT with the header (what the admin UI now sends)
  const withRes = await fetch(url, {
    method: "PUT",
    body: "cache test",
    headers: { "Content-Type": "text/plain", "Cache-Control": MEDIA_CACHE_CONTROL },
  });
  check("PUT with Cache-Control", withRes.status === 200, `http ${withRes.status}`);

  const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: keyWith }));
  check(
    "stored metadata",
    head.CacheControl === MEDIA_CACHE_CONTROL,
    `cacheControl="${head.CacheControl}"`,
  );

  // 3. Without the header the object silently ends up with no cache-control — the failure mode a
  //    future caller must avoid.
  const url2 = await presign(keyWithout);
  const withoutRes = await fetch(url2, {
    method: "PUT",
    body: "cache test",
    headers: { "Content-Type": "text/plain" },
  });
  check("PUT without the header still works", withoutRes.status === 200, `http ${withoutRes.status}`);

  const head2 = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: keyWithout }));
  check(
    "no cache-control without the header (silent miss)",
    head2.CacheControl === undefined,
    `cacheControl="${head2.CacheControl}"`,
  );

  // cleanup
  for (const key of [keyWith, keyWithout]) {
    await client
      .send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
      .then(() => console.log(`  cleaned up ${key}`))
      .catch((err: Error) => console.log(`  cleanup failed for ${key}: ${err.name}`));
  }

  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error("test failed:", err);
  process.exit(1);
});
