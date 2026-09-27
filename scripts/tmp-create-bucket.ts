/**
 * TEMPORARY — create the R2 bucket on the new Cloudflare account with the audited configuration:
 * CORS allowlist, the 60-day contact-upload lifecycle rule, and the r2.dev managed domain.
 *
 * Idempotent: an existing bucket is left in place and its settings are re-applied.
 *
 *   npx tsx scripts/tmp-create-bucket.ts
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const BUCKET = process.env.R2_BUCKET_NAME ?? "level-ground";
const ACCOUNT = (process.env.R2_ACCOUNT_ID ?? process.env.CLOUDFLARE_ACCOUNT_ID) as string;
const TOKEN = process.env.CLOUDFLARE_API_TOKEN as string;

const ORIGINS = [
  "http://localhost:3000",
  "http://192.168.0.101:3000",
  "https://levelgroundlandscape.com",
  "https://www.levelgroundlandscape.com",
  "https://*.vercel.app",
];

const api = async (method: string, path: string, body?: unknown) => {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/r2${path}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    errors?: { code: number; message: string }[];
    result?: unknown;
  };
  return { status: res.status, json };
};

const report = (label: string, status: number, json: { success?: boolean; errors?: unknown; result?: unknown }) => {
  const ok = json.success === true;
  console.log(`${ok ? "ok  " : "FAIL"} ${label} — http ${status}${ok ? "" : ` ${JSON.stringify(json.errors)}`}`);
  return ok;
};

async function main() {
  if (!ACCOUNT || !TOKEN) throw new Error("R2_ACCOUNT_ID / CLOUDFLARE_API_TOKEN missing");

  // 1. Bucket exists?
  const list = await api("GET", "/buckets");
  const rawResult = list.json.result as
    | { buckets?: { name?: string }[] }
    | { name?: string }[]
    | undefined;
  const before = (Array.isArray(rawResult) ? rawResult : (rawResult?.buckets ?? []))
    .map((b) => b.name)
    .filter(Boolean) as string[];
  console.log(`buckets before: ${before.length ? before.join(", ") : "(none)"}`);

  if (!before.includes(BUCKET)) {
    const created = await api("POST", "/buckets", { name: BUCKET });
    report(`create bucket ${BUCKET}`, created.status, created.json);
  } else {
    console.log(`ok   bucket ${BUCKET} already exists`);
  }

  // 2. CORS — same origins as the old policy, minus nothing (testing origins trimmed at handoff).
  const cors = await api("PUT", `/buckets/${BUCKET}/cors`, {
    rules: [
      {
        allowed: { origins: ORIGINS, methods: ["GET", "PUT", "POST", "HEAD"], headers: ["*"] },
        exposeHeaders: ["ETag"],
        maxAgeSeconds: 3600,
      },
    ],
  });
  report("set CORS policy", cors.status, cors.json);

  // 3. Lifecycle — matches the existing "Contact Upload Retention" rule at 60 days.
  const lifecycle = await api("PUT", `/buckets/${BUCKET}/lifecycle`, {
    rules: [
      {
        id: "Contact Upload Retention",
        enabled: true,
        conditions: { prefix: "contact-uploads/" },
        deleteObjectsTransition: { condition: { type: "Age", maxAge: 60 * 24 * 60 * 60 } },
      },
    ],
  });
  report("set lifecycle rule", lifecycle.status, lifecycle.json);

  // 4. r2.dev managed public domain
  const domain = await api("PUT", `/buckets/${BUCKET}/domains/managed`, { enabled: true });
  const domainOk = report("enable r2.dev domain", domain.status, domain.json);
  if (domainOk) {
    const value = domain.json.result as { domain?: string; enabled?: boolean } | undefined;
    console.log(`     R2_BASE_URL → https://${value?.domain ?? "(unknown)"}  (enabled=${value?.enabled})`);
  }

  // 5. Read back everything so the state is confirmed, not assumed.
  const final = await api("GET", `/buckets/${BUCKET}`);
  console.log(`\nfinal bucket: ${JSON.stringify(final.json.result)}`);
  const corsRead = await api("GET", `/buckets/${BUCKET}/cors`);
  console.log(`final CORS: ${JSON.stringify(corsRead.json.result)}`);
  const lifeRead = await api("GET", `/buckets/${BUCKET}/lifecycle`);
  console.log(`final lifecycle: ${JSON.stringify(lifeRead.json.result)}`);
  const domRead = await api("GET", `/buckets/${BUCKET}/domains/managed`);
  console.log(`final domain: ${JSON.stringify(domRead.json.result)}`);
}

main().catch((err) => {
  console.error("bucket setup failed:", err);
  process.exit(1);
});
