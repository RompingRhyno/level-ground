/**
 * Search Console report: sitemaps + URL inspection for every public URL.
 *
 *   node scripts/gsc-report.mjs            # reads https://levelgroundlandscape.com/sitemap.xml
 *   node scripts/gsc-report.mjs --out docs/gsc-report-YYYY-MM-DD.md
 *
 * Needs in the environment (`.env.local`):
 *   GSC_CREDENTIALS_PATH  path to the service-account JSON (chmod 600, outside the repo)
 *   GSC_PROPERTY          e.g. sc-domain:levelgroundlandscape.com
 *
 * Quota: the URL Inspection API allows 2,000 queries/day per property, 600/minute. One run for a
 * 37-page site is negligible; the 300 ms pause keeps it well inside the burst limit.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createSign } from "node:crypto";

const KEY_PATH = process.env.GSC_CREDENTIALS_PATH;
const PROPERTY = process.env.GSC_PROPERTY ?? "sc-domain:levelgroundlandscape.com";
const SITE = process.env.GSC_SITE ?? "https://levelgroundlandscape.com";
const outArg = process.argv.indexOf("--out");
const OUT = outArg > -1 ? process.argv[outArg + 1] : null;

if (!KEY_PATH) throw new Error("GSC_CREDENTIALS_PATH is not set");

const key = JSON.parse(readFileSync(KEY_PATH, "utf8"));
const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const header = b64({ alg: "RS256", typ: "JWT" });
const claims = b64({
  iss: key.client_email,
  scope: "https://www.googleapis.com/auth/webmasters.readonly",
  aud: "https://oauth2.googleapis.com/token",
  iat: now,
  exp: now + 3600,
});
const signer = createSign("RSA-SHA256");
signer.update(`${header}.${claims}`);
const jwt = `${header}.${claims}.${signer.sign(key.private_key, "base64url")}`;

const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwt,
  }),
});
const token = await tokenRes.json();
if (!tokenRes.ok) throw new Error(`token exchange failed: ${token.error} ${token.error_description ?? ""}`);

const auth = { authorization: `Bearer ${token.access_token}` };

const sitemapRes = await fetch(
  `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(PROPERTY)}/sitemaps`,
  { headers: auth },
);
const sitemaps = sitemapRes.ok ? (await sitemapRes.json()).sitemap ?? [] : [];

const xml = await (await fetch(`${SITE}/sitemap.xml`)).text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (!urls.length) throw new Error("no URLs found in the sitemap");

const results = [];
for (const url of urls) {
  const res = await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
    method: "POST",
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ inspectionUrl: url, siteUrl: PROPERTY, languageCode: "en-US" }),
  });
  const body = await res.json();
  if (!res.ok) {
    results.push({ url, error: body.error?.message ?? `HTTP ${res.status}` });
  } else {
    const r = body.inspectionResult?.indexStatusResult ?? {};
    results.push({
      url,
      verdict: r.verdict ?? "",
      coverage: r.coverageState ?? "",
      indexing: r.indexingState ?? "",
      fetch: r.pageFetchState ?? "",
      robots: r.robotsTxtState ?? "",
      crawledAs: r.crawledAs ?? "",
      lastCrawl: r.lastCrawlTime ?? "",
      googleCanonical: r.googleCanonical ?? "",
      userCanonical: r.userCanonical ?? "",
    });
  }
  await new Promise((r) => setTimeout(r, 300));
}

const notIndexed = results.filter((r) => r.verdict && r.verdict !== "PASS");
const indexed = results.length - notIndexed.length;

const lines = [
  `# Search Console report — ${PROPERTY}`,
  "",
  `Generated ${new Date().toISOString()} · ${results.length} URLs · ` +
    `${indexed} passing · ${notIndexed.length} not indexed`,
  "",
  "## Sitemaps",
  "",
  "| sitemap | last downloaded | errors | warnings | submitted |",
  "|---|---|---|---|---|",
  ...(sitemaps.length
    ? sitemaps.map(
        (s) =>
          `| ${s.path} | ${s.lastDownloaded ?? "—"} | ${s.errors ?? 0} | ${s.warnings ?? 0} | ${s.isPending ? "pending" : "yes"} |`,
      )
    : ["| none reported | | | | |"]),
  "",
  "## URL inspection",
  "",
  "| url | verdict | coverage | indexing | fetch | last crawl |",
  "|---|---|---|---|---|---|",
  ...results.map(
    (r) =>
      `| ${r.url} | ${r.error ? "ERROR" : r.verdict} | ${r.error ?? r.coverage} | ${r.indexing ?? ""} | ${r.fetch ?? ""} | ${(r.lastCrawl ?? "").slice(0, 10)} |`,
  ),
  "",
];

if (notIndexed.length) {
  lines.push("## Not indexed", "");
  for (const r of notIndexed) {
    lines.push(`### ${r.url}`, "");
    lines.push(`- verdict: ${r.verdict}`);
    lines.push(`- coverage: ${r.coverage}`);
    if (r.error) lines.push(`- error: ${r.error}`);
    if (r.googleCanonical) lines.push(`- google canonical: ${r.googleCanonical}`);
    if (r.userCanonical) lines.push(`- declared canonical: ${r.userCanonical}`);
    lines.push("");
  }
}

const report = lines.join("\n");
if (OUT) {
  writeFileSync(OUT, report);
  console.log(`written ${OUT}`);
}
console.log(`\n${results.length} URLs · ${indexed} passing · ${notIndexed.length} not indexed\n`);
for (const s of sitemaps) console.log(`sitemap ${s.path}: downloaded=${s.lastDownloaded ?? "—"} errors=${s.errors ?? 0}`);
for (const r of notIndexed) console.log(`NOT INDEXED ${r.url} | ${r.coverage ?? r.error} | ${r.verdict}`);
