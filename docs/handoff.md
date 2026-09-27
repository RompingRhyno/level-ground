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

## What can be scripted from the dev machine

Enabler: a **scoped Cloudflare API token** exported as `CLOUDFLARE_API_TOKEN` (Workers Scripts: Edit,
R2: Edit, Turnstile: Edit, DNS: Edit), plus optionally a Vercel token. Then:

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
