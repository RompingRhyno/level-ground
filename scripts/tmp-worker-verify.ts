/**
 * TEMPORARY — end-to-end check of the contact-upload path against the NEW account's worker.
 *
 * Mirrors what the app does: sign an upload token with UPLOAD_TOKEN_SECRET (same HMAC/base64url
 * scheme as the slot route), PUT it at WORKER_URL/upload, then confirm the object landed in the
 * bucket and clean it up. Also checks the CORS fix: production origin allowed, stranger refused.
 *
 *   npx tsx scripts/tmp-worker-verify.ts
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

import { createHmac } from "node:crypto";
import { DeleteObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";

const b64url = (buf: Buffer) => buf.toString("base64url");

function signToken(
  payload: { sessionId: string; key: string; expiresAt: string; contentType: string },
  secret: string,
): string {
  const encoded = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(createHmac("sha256", secret).update(encoded).digest());
  return `${encoded}.${sig}`;
}

async function main() {
  const secret = process.env.UPLOAD_TOKEN_SECRET as string;
  const workerUrl = (process.env.WORKER_URL as string).replace(/\/$/, "");
  const endpoint = `${workerUrl}/upload`;
  const results: [string, boolean, string][] = [];
  const check = (name: string, ok: boolean, detail: string) => {
    results.push([name, ok, detail]);
    console.log(`  ${ok ? "ok  " : "FAIL"} ${name} — ${detail}`);
  };

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
  const key = `tmp-worker-verify/${Date.now()}.png`;
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const goodToken = signToken(
    { sessionId: `tmp-${Date.now()}`, key, expiresAt, contentType: "image/png" },
    secret,
  );

  // 1. Valid token → 200 and the object exists
  const put = await fetch(endpoint, {
    method: "PUT",
    body: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    headers: { Authorization: `Bearer ${goodToken}`, "Content-Type": "image/png" },
  });
  const putBody = await put.text();
  check("valid token uploads", put.status === 200 && putBody.includes("true"), `http ${put.status} ${putBody.slice(0, 60)}`);

  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    check("object in new bucket", (head.ContentLength ?? 0) > 0, `${head.ContentLength} bytes, type=${head.ContentType}`);
  } catch (err) {
    check("object in new bucket", false, (err as Error).name);
  }

  // 2. Wrong secret → 401
  const badToken = signToken(
    { sessionId: "x", key: `${key}.bad`, expiresAt, contentType: "image/png" },
    `${secret}-wrong`,
  );
  const bad = await fetch(endpoint, {
    method: "PUT",
    body: new Uint8Array([1]),
    headers: { Authorization: `Bearer ${badToken}`, "Content-Type": "image/png" },
  });
  check("wrong secret rejected", bad.status === 401, `http ${bad.status}`);

  // 3. Content-type mismatch → 415
  const mismatch = await fetch(endpoint, {
    method: "PUT",
    body: new Uint8Array([1]),
    headers: { Authorization: `Bearer ${goodToken}`, "Content-Type": "image/jpeg" },
  });
  check("content-type mismatch rejected", mismatch.status === 415, `http ${mismatch.status}`);

  // 4. CORS: production origin allowed, stranger refused
  for (const [label, origin, expect] of [
    ["prod origin allowed", "https://levelgroundlandscape.com", true],
    ["vercel origin allowed", "https://level-ground-something.vercel.app", true],
    ["stranger refused", "https://evil.example.com", false],
  ] as [string, string, boolean][]) {
    const pre = await fetch(endpoint, {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "PUT",
        "Access-Control-Request-Headers": "authorization,content-type",
      },
    });
    const acao = pre.headers.get("access-control-allow-origin");
    check(label, expect ? acao === origin : acao === null, `acao=${acao}`);
  }

  // cleanup
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  console.log(`  cleaned up ${key}`);

  const failed = results.filter(([, ok]) => !ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error("verify failed:", err);
  process.exit(1);
});
