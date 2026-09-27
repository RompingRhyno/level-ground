/**
 * TEMPORARY — establish what r2-upload-limiter can actually do, then clean up after itself.
 *
 * 1. GET on the worker: a 405 with its canned message proves the worker is deployed and reachable
 *    without writing anything.
 * 2. PUT a harmless scratch object through it, confirm via S3 that the object landed in the bucket,
 *    then delete it and confirm the delete.
 *
 * The point is evidence: the code has no authentication, so a successful anonymous write from this
 * machine is a successful anonymous write from anywhere.
 *
 *   npx tsx scripts/tmp-limiter-probe.ts
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

import { DeleteObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";

const LIMITER = "https://r2-upload-limiter.ryan94j.workers.dev";

async function main() {
  // 1. Liveness, no writes
  const get = await fetch(`${LIMITER}/anything.txt`, { method: "GET" });
  const getBody = (await get.text()).slice(0, 120);
  console.log(`GET  → http ${get.status} "${getBody}"`);

  const options = await fetch(`${LIMITER}/anything.txt`, { method: "OPTIONS" });
  console.log(`OPTIONS → http ${options.status}`);

  // 2. Anonymous write through it
  const key = `tmp-limiter-probe-${Date.now()}.txt`;
  const put = await fetch(`${LIMITER}/${key}`, {
    method: "PUT",
    body: "written by an unauthenticated caller\n",
    headers: { "Content-Type": "text/plain" },
  });
  console.log(`PUT  → http ${put.status} "${(await put.text()).slice(0, 120)}"`);

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
    },
    forcePathStyle: false,
  });
  const bucket = process.env.R2_BUCKET_NAME as string;

  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    console.log(`bucket now contains ${key} (${head.ContentLength} bytes) — anonymous write confirmed`);
  } catch (err) {
    console.log(`not found in bucket: ${(err as Error).name} — write did not reach ${bucket}`);
  }

  // 3. Clean up
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    console.log("CLEANUP FAILED — object still present");
  } catch (err) {
    console.log(`cleanup ok — ${key} gone (${(err as Error).name})`);
  }
}

main().catch((err) => {
  console.error("probe failed:", err);
  process.exit(1);
});
