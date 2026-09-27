/**
 * TEMPORARY — status check for every app secret after the Cloudflare/Resend swaps.
 *
 * Reports names, shapes and hashes only, never values. With `--rotate-cron` it also regenerates
 * CRON_SECRET (nothing else holds that value, so rotating it is self-contained). With `--send-test` it
 * proves the new Resend key works by sending one message to the notification recipient(s) in the DB.
 *
 *   npx tsx scripts/tmp-secret-check.ts [--rotate-cron] [--send-test]
 */
import { createHash, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const args = process.argv.slice(2);
const sha = (v: string) => createHash("sha256").update(v).digest("hex").slice(0, 12);

function setEnv(path: string, key: string, value: string) {
  const lines = readFileSync(path, "utf8").split(/(?<=\n)/);
  let done = false;
  const out = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      done = true;
      return `${key}=${value}\n`;
    }
    return line;
  });
  if (!done) out.push(`${key}=${value}\n`);
  writeFileSync(path, out.join(""));
}

function report(label: string, key: string, value: string | undefined, expectPrefix?: string) {
  if (!value) {
    console.log(`  MISSING ${label} (${key})`);
    return;
  }
  const shape = expectPrefix ? `prefix=${value.slice(0, 3)}` : "";
  console.log(`  ${label.padEnd(22)} ${key.padEnd(26)} len=${String(value.length).padStart(3)} ${shape} sha256[:12]=${sha(value)}`);
}

async function main() {
  console.log("── env presence ──");
  report("Resend sending key", "RESEND_API_KEY", process.env.RESEND_API_KEY);
  report("Cron bearer", "CRON_SECRET", process.env.CRON_SECRET);
  report("Worker upload token", "UPLOAD_TOKEN_SECRET", process.env.UPLOAD_TOKEN_SECRET);
  report("Turnstile secret", "TURNSTILE_SECRET_KEY", process.env.TURNSTILE_SECRET_KEY);
  report("Turnstile sitekey", "NEXT_PUBLIC_TURNSTILE_SITE_KEY", process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  report("Cloudflare tooling", "CLOUDFLARE_API_TOKEN", process.env.CLOUDFLARE_API_TOKEN);
  report("R2 access key id", "R2_ACCESS_KEY_ID", process.env.R2_ACCESS_KEY_ID);
  report("R2 secret", "R2_SECRET_ACCESS_KEY", process.env.R2_SECRET_ACCESS_KEY);

  if (args.includes("--rotate-cron")) {
    const next = randomBytes(32).toString("base64url");
    setEnv(".env.local", "CRON_SECRET", next);
    console.log(`\n  rotated CRON_SECRET → new sha256[:12]=${sha(next)} (value never printed)`);
  }

  console.log("\n── turnstile widget vs env ──");
  const token = process.env.CLOUDFLARE_API_TOKEN as string;
  const account = (process.env.R2_ACCOUNT_ID ?? "") as string;
  const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY as string;
  const widgetRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/challenges/widgets/${sitekey}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const widget = (await widgetRes.json()) as { success?: boolean; result?: { sitekey?: string; domains?: string[] } };
  const envSitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  console.log(
    `  ${widget.result?.sitekey === envSitekey ? "ok  " : "FAIL"} .env sitekey matches the account's widget (${envSitekey})`,
  );
  console.log(`  widget domains: ${JSON.stringify(widget.result?.domains)}`);

  const siteverify = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({
      secret: process.env.TURNSTILE_SECRET_KEY as string,
      response: "dummy-token",
    }),
  });
  const sv = (await siteverify.json()) as { "error-codes"?: string[] };
  const codes = sv["error-codes"] ?? [];
  console.log(`  ${codes.includes("invalid-input-response") ? "ok  " : "FAIL"} secret belongs to this widget — codes=${JSON.stringify(codes)}`);

  console.log("\n── notification recipients (DB) ──");
  const prisma = (await import("../src/lib/prisma")).default;
  const recipients = await prisma.contactRecipient.findMany({
    select: { id: true, email: true, name: true },
  });
  for (const r of recipients) console.log(`  #${r.id} ${r.email}${r.name ? ` (${r.name})` : ""}`);
  console.log(`  CONTACT_EMAIL_FROM=${process.env.CONTACT_EMAIL_FROM}`);

  if (args.includes("--send-test")) {
    console.log("\n── resend send test ──");
    if (!recipients.length) {
      console.log("  skipped: no recipients in the DB");
    } else {
      const to = recipients.map((r) => r.email);
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "onboarding@resend.dev",
          to,
          subject: "level-ground: Resend key check",
          text: "Key verification for the new Resend account. Nothing to do — this only confirms the app can send.",
        }),
      });
      const body = (await res.json()) as { id?: string; message?: string; statusCode?: number };
      console.log(
        res.status === 200 && body.id
          ? `  ok   accepted by Resend — id=${body.id}, to=${to.join(", ")}`
          : `  FAIL http ${res.status} ${JSON.stringify(body).slice(0, 200)}`,
      );
    }
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("secret check failed:", err);
  process.exit(1);
});
