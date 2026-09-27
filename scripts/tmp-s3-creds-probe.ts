/**
 * TEMPORARY — can the general Cloudflare API token act as the app's R2 S3 credential?
 *
 * Cloudflare's R2 auth docs say an API token's S3 side is: Access Key ID = the token id, Secret Access
 * Key = the SHA-256 of the token value. This checks that claim against the *new* bucket with a real
 * write/read/delete round trip, which decides whether a second credential is strictly necessary
 * (it is still wanted: this token can also deploy Workers and manage Turnstile).
 *
 * Prints statuses only — never the token, never the derived secret.
 *
 *   npx tsx scripts/tmp-s3-creds-probe.ts
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

import { createHash } from "node:crypto";
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

async function main() {
  const token = process.env.CLOUDFLARE_API_TOKEN as string;
  const account = (process.env.R2_ACCOUNT_ID ?? process.env.CLOUDFLARE_ACCOUNT_ID) as string;
  const bucket = process.env.R2_BUCKET_NAME as string;
  if (!token || !account || !bucket) throw new Error("env missing");

  // 1. Token identity, from the account-scoped verify endpoint
  const verify = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/tokens/verify`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const verifyJson = (await verify.json()) as { result?: { id?: string; status?: string } };
  const tokenId = verifyJson.result?.id;
  console.log(`verify: http ${verify.status} status=${verifyJson.result?.status} id=${tokenId}`);
  if (!tokenId) throw new Error("no token id");

  // 2. Derive the S3 secret exactly the way Cloudflare describes
  const derivedSecret = createHash("sha256").update(token).digest("hex");
  console.log(`derived secret length: ${derivedSecret.length} chars (sha256 hex)`);

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${account}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: tokenId, secretAccessKey: derivedSecret },
    forcePathStyle: false,
  });

  // 3. Read
  try {
    const list = await client.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 5 }));
    console.log(`list: ok — ${list.KeyCount ?? 0} keys visible`);
  } catch (err) {
    console.log(`list: FAILED — ${(err as Error).name}: ${(err as Error).message}`.slice(0, 160));
    return;
  }

  // 4. Write / read back / delete
  const key = `tmp-creds-probe/${Date.now()}.txt`;
  try {
    await client.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: "derived-credential test" }),
    );
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    console.log(`put+head: ok — ${head.ContentLength} bytes stored`);
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    console.log("delete: ok — probe object removed");
  } catch (err) {
    console.log(`write path: FAILED — ${(err as Error).name}: ${(err as Error).message}`.slice(0, 160));
  }
}

main().catch((err) => {
  console.error("probe failed:", err);
  process.exit(1);
});
