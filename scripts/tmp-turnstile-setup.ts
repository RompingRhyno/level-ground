/**
 * TEMPORARY — create the Turnstile widget on the new account and wire its keys into the env files.
 *
 * - Creates (or reuses) a widget named "level-ground contact form" with the site's hostnames.
 * - Writes NEXT_PUBLIC_TURNSTILE_SITE_KEY into `.env` (public, ships to the browser) and
 *   TURNSTILE_SECRET_KEY into `.env.local` (server-only). Neither value is printed.
 * - Proves the secret is recognised by calling siteverify with a dummy token: a valid secret answers
 *   `invalid-input-response`, a bogus one answers `invalid-input-secret`.
 *
 *   npx tsx scripts/tmp-turnstile-setup.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const WIDGET_NAME = "level-ground contact form";
const DOMAINS = [
  "levelgroundlandscape.com",
  "www.levelgroundlandscape.com",
  "localhost",
  "level-ground.vercel.app",
];

function upsertEnv(path: string, key: string, value: string): boolean {
  const lines = readFileSync(path, "utf8").split(/(?<=\n)/);
  let replaced = false;
  const out = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      replaced = true;
      return `${key}=${value}\n`;
    }
    return line;
  });
  if (!replaced) out.push(`${key}=${value}\n`);
  writeFileSync(path, out.join(""));
  return replaced;
}

async function main() {
  const token = process.env.CLOUDFLARE_API_TOKEN as string;
  const account = (process.env.R2_ACCOUNT_ID ?? process.env.CLOUDFLARE_ACCOUNT_ID) as string;
  const api = `https://api.cloudflare.com/client/v4/accounts/${account}/challenges/widgets`;

  const listRes = await fetch(api, { headers: { Authorization: `Bearer ${token}` } });
  const list = (await listRes.json()) as { result?: { name?: string; sitekey?: string }[] };
  const existing = (list.result ?? []).find((w) => w.name === WIDGET_NAME);

  let sitekey = existing?.sitekey as string | undefined;
  let secret: string | undefined;

  if (existing) {
    console.log(`ok   widget already exists (sitekey ${sitekey?.slice(0, 10)}…)`);
    const getRes = await fetch(`${api}/${sitekey}`, { headers: { Authorization: `Bearer ${token}` } });
    const got = (await getRes.json()) as { result?: { secret?: string } };
    secret = got.result?.secret;
  } else {
    const createRes = await fetch(api, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: WIDGET_NAME, domains: DOMAINS, mode: "managed" }),
    });
    const created = (await createRes.json()) as {
      success?: boolean;
      errors?: unknown;
      result?: { sitekey?: string; secret?: string; domains?: string[] };
    };
    if (!created.success) {
      console.log(`FAIL create widget — ${JSON.stringify(created.errors)}`);
      process.exit(1);
    }
    sitekey = created.result?.sitekey;
    secret = created.result?.secret;
    console.log(`ok   created widget — domains=${JSON.stringify(created.result?.domains)}`);
  }

  if (!sitekey || !secret) throw new Error("sitekey or secret missing from the API response");

  console.log(`sitekey (public): ${sitekey}`);
  console.log(`  .env      NEXT_PUBLIC_TURNSTILE_SITE_KEY replaced=${upsertEnv(".env", "NEXT_PUBLIC_TURNSTILE_SITE_KEY", sitekey)}`);
  console.log(`  .env.local TURNSTILE_SECRET_KEY replaced=${upsertEnv(".env.local", "TURNSTILE_SECRET_KEY", secret)}`);

  const verifyBody = new URLSearchParams({ secret, response: "dummy-token", remoteip: "127.0.0.1" });
  const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: verifyBody,
  });
  const verify = (await verifyRes.json()) as { success?: boolean; "error-codes"?: string[] };
  const codes = verify["error-codes"] ?? [];
  const recognised = codes.includes("invalid-input-response") && !codes.includes("invalid-input-secret");
  console.log(`${recognised ? "ok  " : "FAIL"} secret recognised by siteverify — codes=${JSON.stringify(codes)}`);
}

main().catch((err) => {
  console.error("turnstile setup failed:", err);
  process.exit(1);
});
