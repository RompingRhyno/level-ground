/**
 * TEMPORARY — does the *app's own* credential shape work against the new bucket?
 *
 * Builds the S3 client exactly like src/lib/r2.ts does and exercises what the code needs:
 * list (tooling/verification), put, head, delete. Also asserts which account/bucket/domain the env
 * points at, so a half-applied swap shows up immediately.
 *
 *   npx tsx scripts/tmp-new-creds-check.ts
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

import {
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const EXPECTED_ACCOUNT = "319c49fdb7d685313f30b07d52220dcf";
const EXPECTED_HOST = "pub-5dd7bf9ee41145a89487852a67ee30a1.r2.dev";

async function main() {
  const accountId = process.env.R2_ACCOUNT_ID as string;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID as string;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY as string;
  const bucket = process.env.R2_BUCKET_NAME as string;
  const base = process.env.R2_BASE_URL ?? "";

  const checks: [string, boolean, string][] = [
    ["R2_ACCOUNT_ID is the new account", accountId === EXPECTED_ACCOUNT, accountId?.slice(0, 8) + "…"],
    [
      "R2_BASE_URL is the new publish domain",
      base.replace(/^https?:\/\//, "").replace(/\/$/, "") === EXPECTED_HOST,
      base.replace(/^https?:\/\//, ""),
    ],
    ["R2_BUCKET_NAME unchanged", bucket === "level-ground", bucket],
  ];

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: false,
  });

  // list — proves Read applies to this bucket
  try {
    const list = await client.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 10 }));
    checks.push(["list objects", true, `${list.KeyCount ?? 0} keys (new bucket, expect 0)`]);
  } catch (err) {
    checks.push(["list objects", false, (err as Error).name]);
  }

  // write / read back / delete — the admin upload and cleanup-cron paths
  const key = `tmp-creds-check/${Date.now()}.txt`;
  try {
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: "new-credential test" }));
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    checks.push(["put + head", (head.ContentLength ?? 0) > 0, `${head.ContentLength} bytes`]);
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    checks.push(["delete object", true, "probe removed"]);
  } catch (err) {
    checks.push(["write path", false, (err as Error).name]);
  }

  for (const [name, ok, detail] of checks) console.log(`  ${ok ? "ok  " : "FAIL"} ${name} — ${detail}`);
  const failed = checks.filter(([, ok]) => !ok).length;
  console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error("check failed:", err);
  process.exit(1);
});
