/**
 * Inspect specific URLs in Search Console.
 *
 *   node scripts/gsc-inspect.mjs https://example.com/a https://example.com/b ...
 *
 * Prints verdict, coverage state, indexing state, fetch state and canonicals. Reads
 * GSC_CREDENTIALS_PATH and GSC_PROPERTY from the environment (`.env.local`).
 */
import { readFileSync } from "node:fs";
import { createSign } from "node:crypto";

const KEY_PATH = process.env.GSC_CREDENTIALS_PATH;
const PROPERTY = process.env.GSC_PROPERTY ?? "sc-domain:levelgroundlandscape.com";
const urls = process.argv.slice(2).filter((a) => a.startsWith("http"));
if (!KEY_PATH) throw new Error("GSC_CREDENTIALS_PATH is not set");

const key = JSON.parse(readFileSync(KEY_PATH, "utf8"));
const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
const iat = Math.floor(Date.now() / 1000);
const header = b64({ alg: "RS256", typ: "JWT" });
const claims = b64({
  iss: key.client_email,
  scope: "https://www.googleapis.com/auth/webmasters.readonly",
  aud: "https://oauth2.googleapis.com/token",
  iat,
  exp: iat + 3600,
});
const signer = createSign("RSA-SHA256");
signer.update(`${header}.${claims}`);
const jwt = `${header}.${claims}.${signer.sign(key.private_key, "base64url")}`;

const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
});
const token = await tokenRes.json();
if (!tokenRes.ok) throw new Error(token.error_description ?? token.error);

for (const url of urls) {
  const res = await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
    method: "POST",
    headers: { authorization: `Bearer ${token.access_token}`, "content-type": "application/json" },
    body: JSON.stringify({ inspectionUrl: url, siteUrl: PROPERTY, languageCode: "en-US" }),
  });
  const body = await res.json();
  if (!res.ok) {
    console.log(`${url}\n  ERROR ${res.status}: ${body.error?.message ?? ""}\n`);
    continue;
  }
  const r = body.inspectionResult?.indexStatusResult ?? {};
  console.log(`${url}`);
  console.log(`  verdict=${r.verdict} coverage=${r.coverageState}`);
  console.log(`  indexing=${r.indexingState} fetch=${r.pageFetchState} robots=${r.robotsTxtState}`);
  console.log(`  lastCrawl=${r.lastCrawlTime ?? "—"} crawledAs=${r.crawledAs ?? "—"}`);
  console.log(`  googleCanonical=${r.googleCanonical ?? "—"}`);
  console.log(`  userCanonical=${r.userCanonical ?? "—"}`);
  console.log("");
  await new Promise((r2) => setTimeout(r2, 300));
}
