# Client handoff — accounts, secrets and cutover

Running checklist for moving this project's services onto the client's own accounts. No secret values
belong in this file — only names, owners and steps.

Status: draft, built while migrating to new accounts (2026-09).

## Services and what each owns

| Service | Holds | Env vars (where) | Notes |
|---|---|---|---|
| **Neon** (Postgres) | All content: pages, folders, assets, users, sessions | `DATABASE_URL`, `DATABASE_URL_UNPOOLED` (`.env.local`) | New project created during the migration (`ep-raspy-frost…`, us-west-2, PG 18.6). Old project stays alive as fallback until the handoff is signed off. |
| **Cloudflare — R2** | Media bucket (`R2_BUCKET_NAME`), public publish domain | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` (`.env.local`), `R2_BASE_URL` (`.env`) | S3 credentials are dashboard-created (R2 → Manage API tokens). Publish domain is `r2.dev` today; custom domain later. |
| **Cloudflare — Worker** | Contact-form upload endpoint (`workers/upload-worker`) | `WORKER_URL` (`.env`), `UPLOAD_TOKEN_SECRET` (`.env.local` + worker secret) | Deployed with `wrangler deploy`; the secret is set with `wrangler secret put` and never lives in the repo. |
| **Cloudflare — Turnstile** | Contact-form CAPTCHA | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (`.env`), `TURNSTILE_SECRET_KEY` (`.env.local`) | Third piece under the same Cloudflare account — easy to forget. |
| **Resend** | Contact notifications + admin auth mail | `RESEND_API_KEY` (`.env.local`), `CONTACT_EMAIL_FROM` (`.env`) | Needs a **verified domain** for the client; the sandbox sender only delivers to the account owner's address. |
| **Vercel** | Hosting + the contact-cleanup cron | `CRON_SECRET` (`.env.local`), all of the above | Cron hits `/api/contact/cleanup` daily (`vercel.json`). |
| **GitHub** | Source of truth | — | Repo + the SSH key are part of the handoff, not runtime. |
| **Domain + DNS** | Production origin, Resend records, R2 custom domain later | `NEXT_PUBLIC_BASE_URL` (`.env`) | Registrar + Cloudflare zone. Set `NEXT_PUBLIC_BASE_URL` to the real origin once it exists. |
| **Mailbox** | Receives contact-form mail; the address Resend sends as | `CONTACT_EMAIL_FROM` | If it is currently a personal mailbox, the client needs their own. |

Runtime dependencies with no account: `unpkg.com` (ffmpeg WASM core, fetched in the browser when
converting video), `challenges.cloudflare.com` (Turnstile script), `fonts.googleapis.com`.

## Cloudflare API token (local tooling only)

Needed once, to let this machine create/deploy on the new account. Create under the new Cloudflare
account → My Profile → API Tokens → Create Custom Token:

| Scope | Permission | Why |
|---|---|---|
| Account | **Workers → `Admin`** (product scope) | Cloudflare replaced "Workers Scripts: Edit" with Workers roles, where `Editor` can deploy but **cannot create** a Worker — and this account has none yet. `Admin` covers create, deploy, secrets and `wrangler tail`; `Editor` would be enough only after the Worker exists. |
| Account | R2 write/edit (legacy name: "Workers R2 Storage: Edit") | only for `wrangler r2 bucket create`. Every object-level operation uses the R2 **S3** keys instead, not this token. |
| Account | **Turnstile: Edit** / "Turnstile Sites: Edit" | create the widget, read both keys |
| Zone | **DNS → Write** (added by editing the token once the domain joins the account) | create/edit DNS records — Resend verification, Email Routing MX |
| Zone | **DNS → Read** | read records back when verifying |

The domain stays on the old site's DNS until the full migration, so the two zone rows cannot be
attached yet. That blocks nothing today: R2 bucket, worker deploy and Turnstile are all account-scoped.
On migration day, edit the existing token to add them and select the zone — no second token needed.

Note: the *account*-level "Account DNS Settings: Edit" is a different permission (account DNS defaults
such as enforce-DNS-only and zone defaults) — it does **not** grant record editing. Likewise the
Workers `Admin` role covers `wrangler tail`, so the legacy "Workers Tail Read" is unnecessary.

Cloudflare's legacy→new mapping (from the Workers docs): `Workers Scripts Read` → `Content Read-Only`,
`Workers Scripts Edit` → `Editor`, both at the Workers **product** scope; `Metadata Read-Only` is the
one `wrangler tail` needs on its own. Legacy names still work — there is no deprecation date.

Skip "All resources / write all" — that token sits in a file on disk and only ever runs four
commands. Add the specific zone in the Zone Resources step once the domain exists in the account; if
the domain is not there yet, create the token account-scoped now and add DNS:Edit later.

**Separate from this token:** the app's runtime R2 credentials come from the R2 dashboard
(R2 → Account Details → Manage API Tokens → *Create Account API token*), permission **Object Read &
Write, scoped to the new bucket. That pair (`R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`) is what the
presigned uploads and deletes use; the secret is shown once at creation, while the Access Key ID stays
listed — a lost secret means rolling the token. R2 must be "purchased" (free tier counts) before that
page allows token creation.

Cloudflare also shows S3-compatible credentials while creating a *general* API token that carries R2
permissions. Those belong to that token (the Access Key ID is the token's id; the secret is the
SHA-256 of its value, per Cloudflare's R2 auth docs). Convenient for one-off tooling from the dev
machine, but **not** as the app's runtime credential: a token that can also deploy Workers and manage
Turnstile is far too broad to sit in the app's environment. Create the dedicated bucket-scoped pair
once the bucket exists and use *that* for both the object copy and the app.

R2 itself must be **enabled on the account** first (Dashboard → R2 → enable; free tier) — until then
every R2 call answers `Please enable R2 through the Cloudflare Dashboard.`

Token facts, verified 2026-09-27: account `levelgrounddev@gmail.com` (`319c49fdb7d685313f30b07d52220dcf`,
matching `CLOUDFLARE_ACCOUNT_ID`), account-owned token active, expires **2026-12-26**; Turnstile and
Workers endpoints answer, R2 does not until enablement. `/user/tokens/verify` returns *Invalid API
Token* for this kind of token by design — the account-scoped endpoint is
`/accounts/{id}/tokens/verify`.

**Two credential sets coexist until the media copy is done.** The old account's keys must keep working
as the copy *source*, so the new pair goes in under temporary names —
`R2_NEW_ACCESS_KEY_ID` / `R2_NEW_SECRET_ACCESS_KEY` — and the main names (`R2_ACCOUNT_ID`,
`R2_BUCKET_NAME`, `R2_BASE_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`) are switched to the new
account only once the copy verifies. The S3 endpoint takes no variable: the app builds it from the
account id as `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, so the value Cloudflare showed
should match that shape for the new account id.

- **Placement:** `CLOUDFLARE_API_TOKEN=` and (if the account is not the only one on the token)
  `CLOUDFLARE_ACCOUNT_ID=` in `.env.local`. Both are read by `wrangler`; values are never printed.
- **Do not add either to Vercel** — they are local tooling credentials, not app runtime config.
- Set an expiry (a week is plenty for the handoff) and delete the token once the migration is done.
- First thing to run against it: `wrangler whoami` plus `GET /user/tokens/verify`, to confirm the
  scopes before anything is created.

## Email: what Cloudflare covers, and what it does not

The client's domain has no mail hosting, so the plan was Email Routing + Email Sending. Worth being
precise, because these split neatly:

- **Email Routing = inbound only.** It forwards `info@domain` to a real mailbox. Cloudflare's own
  postmaster docs: *"Email Routing does not support sending or replying from your Cloudflare domain.
  When you reply to emails forwarded by Email Routing, the reply will be sent from your destination
  address (like my-name@gmail.com), not from info@yourdomain.com."* So the client can *receive*
  contact-form mail at a domain address, but their replies show their personal mailbox.
- **Email Sending** (the permission added pre-emptively) is a Cloudflare beta for *programmatic*
  sending — a Worker binding (`env.EMAIL.send`) or the API. It can send from the domain, but it is not
  an SMTP service, so it does not give a human mail client "send as info@domain" the way Gmail's
  send-as needs.
- **The app's own outbound mail already goes through Resend** (contact notifications, invite/unlock/
  reset). That only needs the domain verified in Resend, which is a set of DNS records — hence the
  DNS:Write permission above. Nothing about the app changes if Email Routing is enabled.

### The flow that actually works: route inbound with Cloudflare, send outbound with Resend

Note what each piece is *not* for. The contact notification itself needs no Cloudflare at all — Resend
delivers it to the owner's personal mailbox directly, which is already working today. Routing's only
job is to give the domain an **inbox**, and that is needed for exactly two things: reading Gmail's
send-as confirmation code, and letting customers' replies land somewhere instead of bouncing — once
outgoing mail carries the domain address, Reply goes *to* the domain, so something has to receive
there. Free, and Resend's records live on the `send.` subdomain with routing's on the root, so the two
do not collide.

Cloudflare cannot rewrite a reply the owner sends from their own mail client — that message never
touches Cloudflare; it leaves via whatever service that client uses. But the two halves compose with
what the project already has:

1. **Inbound — Cloudflare Email Routing.** Add `levelgroundlandscape.com` to Cloudflare, enable Email
   Routing, route `info@levelgroundlandscape.com` → the owner's personal mailbox. Free; the domain has
   no mailboxes today, so the MX change costs nothing.
2. **Outbound — Resend SMTP as a "send mail as" alias.** Once the domain is verified in Resend (SPF +
   DKIM + DMARC + the `send` subdomain MX, all DNS-only in Cloudflare), the owner can add
   `info@levelgroundlandscape.com` in Gmail under Settings → Accounts → "Send mail as":
   SMTP `smtp.resend.com`, port 465 (SSL) or 587 (STARTTLS), username literally `resend`, password = a
   Resend **API key**. Gmail mails a confirmation code to the address — and step 1 is what makes that
   code readable. Tick "Treat as an alias" so replies to routed mail use the domain address
   automatically.
3. **Key hygiene.** Create a *separate* Resend key for the owner's mail client, scoped to sending from
   that domain — never the app's key. The app's key can send as anything on the domain; the client's
   should not.
4. **Result.** Contact form → notification to the owner → Reply (the notification now carries the
   visitor's address as Reply-To, so Reply goes to the customer) → the customer sees
   `info@levelgroundlandscape.com`.

Without step 2, replies leave as the owner's personal address — that is what Cloudflare's postmaster
docs mean when they say Email Routing cannot send or reply from the domain.

**Email Routing needs no token permission if done in the dashboard** — Compute → Email Service → Email
Routing → Onboard Domain, which adds the MX, SPF and DKIM TXT records itself; then add the destination
address (Cloudflare mails it a verification link — the owner must click it, so this step is manual
either way) and create the rule `info@` → personal mailbox. To script it instead, the pair is
`Email Routing Addresses: Edit` (account-scoped destinations) plus `Email Routing Rules: Edit`
(zone-scoped, so it joins the migration-day rows alongside `DNS: Edit`). Not worth it for three clicks.

## R2 audit — what the new bucket should copy, and what it should change

Measured 2026-09-27 against the live bucket, not assumed.

### Current state

- **`level-ground`, 28 objects, 113.7 MB**, location hint WNAM. Every key is **legacy flat**
  (`<timestamp>-<filename>`, no `media/` prefix): the `media/<folderSlug>/…` scheme in
  `storageKeyFor()` is newer than all existing content, so the new bucket will hold a mix. The copy
  preserves keys; no key rewriting is needed.
- **No `contact-uploads/` objects exist at all** — see the bug below.
- Object metadata: `contentType` set; **`Cache-Control` never set on anything**; no custom metadata.
- CORS and lifecycle config **cannot be read** with object-scoped S3 credentials (`403 AccessDenied` —
  bucket config needs an Admin-scoped R2 token). Read the CORS policy from the dashboard before
  creating the new bucket so the new one is not a downgrade; lifecycle is almost certainly unset.
- **The DB hard-codes the publish domain.** 3 `Page` rows carry 5 references
  (`sections[0].image`, `sections[1].videoUrl`, `sections[2].services[1].image`) and all 27 `Asset` rows
  carry 28 (`publicUrl`, `meta.poster`). So the cutover is **copy + base-URL rewrite in Postgres** —
  the site will keep serving from the old bucket until the rewrite runs.

### Bugs and gaps found

1. **The contact-form uploader cannot work in production.** The deployed worker replies to every
   preflight with `access-control-allow-origin: http://localhost:3000` — `ALLOWED_ORIGIN` in
   `wrangler.toml` is dev-only — so a browser on the real domain is refused. Zero `contact-uploads/`
   objects is consistent with the feature never having succeeded in production. Fix: accept a list of
   origins (dev + prod) and set the production origin at deploy.
2. **No `Cache-Control` on uploads** — browser caching is heuristic. Media keys are timestamped and
   never overwritten, so `public, max-age=31536000, immutable` is safe and a straight win. Set at
   upload (presign `CacheControl`, worker `httpMetadata.cacheControl`). Caveat: a re-encoded rendition
   reuses its source key, so an update would not reach already-cached clients.
3. **`contact-uploads/` accumulates**: the cleanup cron deletes the DB row but *preserves* the object
   for `used` uploads (the emailed attachment is the record), so those photos stay in the bucket
   forever with nothing referencing them. A lifecycle rule is the right home for that expiry.

Settings adopted for contact-form uploads live in **code, not bucket config**, and carry over as-is:
worker MIME allowlist (jpeg/png/webp/heic/heif), 10 MB cap, HMAC-signed token bound to key + content
type + session expiry, 15-minute sessions, max 5 files, slot states with retry-then-dead-letter.

### Recommended config for the new bucket

| Setting | Decision |
|---|---|
| Name | `level-ground` — keeps `R2_BUCKET_NAME` unchanged at cutover |
| Location | default (automatic); WNAM hint unnecessary |
| Public access | r2.dev managed domain now (that is `R2_BASE_URL`); custom domain later (r2.dev is rate-limited and documented as non-production) |
| CORS | explicit rule — methods `GET, PUT, POST, HEAD` (mirroring the current policy), header `*`, expose `ETag`, max age 3600; origins `http://localhost:3000`, `http://192.168.0.101:3000`, `https://levelgroundlandscape.com`, `https://www.levelgroundlandscape.com`, `https://*.vercel.app` |
| Lifecycle | `contact-uploads/` expires after **60 days** — the current bucket already carries a "Contact Upload Retention" rule at 60 days, so the new bucket matches it instead of inventing a number |
| Cache-Control | `media/` immutable 1 year (implemented, verified); contact uploads `public, max-age=600` in the worker |
| Credentials | dedicated bucket-scoped R2 token for both copy and runtime; the general API token stays tooling-only |

### Decisions taken 2026-09-27

- Bucket name reused. **No API token for the old account is needed** — the two settings that mattered
  (CORS policy, the 60-day retention rule) were read from the dashboard and are recorded above.
- **Worker CORS fixed in code**: `ALLOWED_ORIGIN` → `ALLOWED_ORIGINS`, a comma-separated allowlist with
  `*.` subdomain support; an unmatched origin now gets *no* `Access-Control-Allow-Origin` instead of a
  wrong one. Production and Vercel origins are included, so the contact-form uploader can work outside
  localhost for the first time.
- **Immutable caching for media uploads**: the presign route sets `CacheControl`, both browser call
  sites send it, and contact uploads set theirs in the worker. Verified against the live bucket — with
  the header the object stores `cache-control: public, max-age=31536000, immutable`; without it the
  object gets none, *silently* (the presigned URL signs only `host`, so nothing enforces the value).
- **Handoff trim**: remove the localhost/LAN/Vercel origins from both the bucket CORS policy and the
  worker's `ALLOWED_ORIGINS`. The worker list lives in `wrangler.toml` — a dashboard edit to that var
  is overwritten by the next `wrangler deploy`.

### Bucket created 2026-09-27

`level-ground` now exists on the new account (WNAM, jurisdiction default), configured through the
Cloudflare API and read back:

- **Public:** r2.dev enabled → `R2_BASE_URL` becomes
  `https://pub-5dd7bf9ee41145a89487852a67ee30a1.r2.dev` (404 on an unknown key confirms it is live).
- **CORS:** the five origins above; verified behaviourally — allowed origin gets a 204 preflight with a
  matching `Access-Control-Allow-Origin`, a disallowed one gets **403 from R2 itself**.
- **Lifecycle:** "Contact Upload Retention", `contact-uploads/`, 60 days.

**No bulk object copy** (decision): media gets re-uploaded through the new bucket during a content
pass, which also exercises the upload flow. Consequence to keep in mind: the 27 existing assets and the
folder covers still live *only* in the old bucket, and page sections reference them by absolute URL — so
nothing breaks until that bucket is deleted. Retire the old account only after the content pass has
replaced those references, or copy the 28 objects first if the pass is not happening.

Vercel cron: `vercel.json` ships the daily cleanup job with the repo, so the new project picks it up on
deploy. It needs `CRON_SECRET` in the environment (Vercel sends it as the bearer token) and Hobby allows
one run per day. Disable the old project's cron once the new deployment is live so cleanup never runs
twice.

**Location WNAM is auto-placement, and it is the right one.** The create call passed no location hint —
R2 chose WNAM and reported it back, exactly as the old bucket reports WNAM via `GetBucketLocation`. For
a Vancouver-only audience that is the closest R2 storage region, so there is nothing to investigate; the
hint is also fixed at creation, which settles it.

### Old-account worker inventory

The deployed `level-ground-upload-worker` matches this repo (variable `ALLOWED_ORIGIN`, secret
`UPLOAD_TOKEN_SECRET`, binding `R2_BUCKET = level-ground`, no cron triggers) — no config drift to
reconcile before the new deploy.

But the dashboard also shows a second worker, **`r2-upload-limiter`**, bound to the same bucket with no
vars or secrets, and it appears **nowhere** in this repo (no code, no config, no env reference; the app
only knows `WORKER_URL`). Its deployed code was read and then probed:

- On paper it accepts any PUT path, performs **no authentication**, and writes the body to the bucket
  key taken from the URL, with a 10 MB size cap. That is an open write endpoint into a publicly
  readable bucket.
- Measured: it is live (`GET` → 405 with its canned message), but **it cannot actually write.** Every
  PUT dies inside `R2_BUCKET.put()` because the body is piped through a `TransformStream`, which has no
  known length, and the R2 API rejects that — the worker reports it as a misleading 413. A probe upload
  left nothing in the bucket, and the probe object was deleted either way.
- Recommendation: **delete it** (dashboard, 30 seconds) rather than park it. It is unattended code with
  no auth, no owner and no consumer in this project, and it never worked as written on the current
  runtime. Do not recreate it on the new account. If the old site turns out to rely on it, delete it
  right after the migration instead.

### Billing

R2 asked for a credit card on the new account. **Replace the stored payment method with the owner's
card before sign-off** — the client's account must not depend on your personal card, and the same
check applies to any other service where a card was entered.

`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` are dev-machine tooling only: nothing in `src/` reads
them, so they are correctly absent from production. Never add them to Vercel.

## Domain migration day (levelgroundlandscape.com)

The domain keeps serving the old site on its current DNS until the full migration, so every zone-scoped
task queues up for one session — in this order, because the old site must not drop out along the way:

1. **Add the zone** in the new Cloudflare account and review what Cloudflare imports. The old site's
   A/CNAME (and any TXT verification records) must survive — the old site keeps serving as long as
   those records still point at the old host. Anything Cloudflare proxies for a host it does not host
   needs care: keep those records **DNS-only** unless the old site is fine being proxied.
2. **Flip the nameservers** at the registrar to the pair the new account assigns, then confirm the old
   site still resolves and serves.
3. **Add the new records:** Resend verification (SPF/DKIM/DMARC + the `send.` MX), Email Routing's MX,
   and add the real domain to the Turnstile widget's hostname list.
4. **Swap the media credentials** once the object copy verifies: `R2_ACCESS_KEY_ID` /
   `R2_SECRET_ACCESS_KEY` → the new pair, `R2_ACCOUNT_ID` → the new account, and
   `R2_BUCKET_NAME` / `R2_BASE_URL` → the new bucket and its publish domain. Delete the temporary
   `R2_NEW_*` names afterwards. An upload through the admin exercises the new bucket end to end.
   **Then rewrite the publish domain in the database** — `Page.sections` and `Asset.publicUrl` /
   `meta.poster` hold absolute URLs (5 + 28 references), and until they point at the new domain the
   site keeps serving from the old bucket. Verify zero old-domain references remain afterwards, and
   purge the affected cache tags.
5. **Cut the app over:** custom domain in Vercel, `NEXT_PUBLIC_BASE_URL` → the real origin, then the
   smoke checks (home, /projects, both detail pages, a 404, /sitemap.xml, /admin redirect).

## What can be scripted from the dev machine

Enabler: a **scoped Cloudflare API token** exported as `CLOUDFLARE_API_TOKEN` (Workers `Admin`,
R2 write/edit, Turnstile `Edit`; Zone `DNS: Edit` added once the domain is in the account), plus
optionally a Vercel token. Then:

- `wrangler whoami` / `wrangler deploy` / `wrangler secret put …` — worker deploy and secret rotation.
- `wrangler r2 bucket create <name>` and bucket CORS via the S3 API (the app uploads straight from the
  browser with presigned URLs, so CORS must match the site origin).
- Turnstile widget creation via the Cloudflare API (`POST /accounts/{id}/challenges/widgets`), then
  writing both keys into the env files without printing them.
- R2 → R2 object copy with a Node script using the existing `@aws-sdk/client-s3` (no rclone/aws CLI on
  this box), followed by a key/byte-count comparison of both buckets.
- Resend domain creation + DNS record fetch via the Resend API (key already in env), adding the records
  through the Cloudflare DNS API, then polling until Resend reports verified.
- Neon copy with `scripts/migrate-db.ts` (dump → restore → per-table hash verify → `prisma migrate
  status`).
- Vercel env vars via the Vercel API, if a token is available.

Cannot be scripted here: creating accounts, accepting terms, interactive logins and 2FA (unless the
credentials are saved in the Hermes vault and the second factor is approved interactively), R2 S3
API-token creation (dashboard-only), registrar steps, and anything requiring a password or token typed
into chat — those go into env files or the vault instead.

## Secret rotation order (do it under the client's accounts)

1. Create the client's Cloudflare / Neon / Resend / Vercel / GitHub accounts, then **invent nothing**:
   generate fresh values for every secret rather than reusing the current ones.
2. `UPLOAD_TOKEN_SECRET` — new value into `.env.local`, `workers/upload-worker/.dev.vars`, then
   `npx wrangler secret put UPLOAD_TOKEN_SECRET` from `workers/upload-worker/`, then Vercel. Rotate all
   three together: a mismatch makes every visitor upload answer 401.
3. `CRON_SECRET` — Vercel + local; the cleanup cron rejects a wrong value.
4. R2 S3 credentials — dashboard-created, scoped to the new bucket; old pair deleted after the copy.
5. Turnstile keys, Resend key, then the Neon URLs.

## Cutover verification

- `npx tsx scripts/check-media-lib.ts` — 27 lib assertions.
- `npx tsc --noEmit` and `npm run build`; public routes `/`, `/projects`, one detail page, unknown slug
  → 404; `/sitemap.xml` lists visible folders only; `/robots.txt` disallows `/admin`.
- Admin: sign-in, sign-out (row must be deleted from `session`), password change (other sessions
  revoked).
- Worker: a token signed with the current secret gets `200 {"ok":true}`; the leaked/old value gets 401.
- Cloudflare worker logs: `npx wrangler tail`.

## Open items

- [ ] Client accounts created (incl. **Neon** — first omission, plus Turnstile under Cloudflare).
- [ ] Resend domain verified for the client domain.
- [ ] `NEXT_PUBLIC_BASE_URL` set to the production origin in Vercel.
- [ ] Old Neon project retired; local dump and `.env.pre-cutover-backup` deleted.
- [ ] Deciding whether R2 gets a custom domain (then `R2_BASE_URL` changes; `r2KeysFromMeta` already
      copes with either form).
