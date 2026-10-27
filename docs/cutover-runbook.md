# Cutover runbook — levelgroundlandscape.com

Companion to `docs/handoff.md` (accounts, secrets, inventory) and
`docs/workers-migration-plan.md` (hosting after launch). This file is the *doing* order.

**Decisions locked**

- Hosting at cutover: **Vercel (Pro plan)**. Workers migration is a post-launch project.
- Mail: **Proton, on the owner's paid plan**, apex MX. Google Workspace is **not** carried into the
  new zone; it stays alive as the old mailbox until the overlap is over.
- App mail: **Resend**, root domain verified, custom return-path `send`, tracking off.
- Canonical host: **apex** (`https://levelgroundlandscape.com`); `www` 308s to it.
- Media: R2 stays; `assets.levelgroundlandscape.com` custom domain after the zone is active.
- DNS: new Cloudflare zone in the accessible account; registrar is **Decibite** (Tucows) and the only
  thing it controls is the NS pair. Its DNS panel is a dormant WP Engine template — **never edit it**.

**Current state (2026-10-26)**

| thing | state |
|---|---|
| Live DNS | old Cloudflare zone (`renan`/`tori.ns.cloudflare.com`), apex+www proxied to WP Engine, five Google MX, **no SPF/DKIM/DMARC/CAA** |
| New Cloudflare zone | created, **pending**; `CNAME @` and `CNAME www` → `9fb94a184a9904e8.vercel-dns-017.com`, DNS-only, TTL Auto |
| Vercel | project deploys; `levelground-seven.vercel.app` valid; `levelgroundlandscape.com` added, Invalid Configuration (expected) |
| Proton | not set up for the domain yet |
| Resend | domain not added yet |

---

## Phase A — today, nothing live changes

**A1. Vercel — finish the domain cards**
- [ ] Add `www.levelgroundlandscape.com` (Connect to an environment → Production, *not* the
      apex→www redirect option).
- [ ] Copy the `www` card's DNS target (usually the same `9fb94a184a9904e8.vercel-dns-017.com`).
- [ ] Set `levelgroundlandscape.com` as **primary**; on `www`, set **Redirect to**
      `levelgroundlandscape.com`, **308 Permanent**.
- [ ] Upgrade the project to **Vercel Pro** and set a spend limit. Hobby is non-commercial — the client
      site cannot stay on it.

**A2. Vercel — production readiness**
- [ ] Confirm a production deployment of `master` (`f5c3fe3` or later) is live on
      `level-ground-seven.vercel.app`.
- [ ] Confirm the production env has all of: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `R2_ACCOUNT_ID`,
      `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_BASE_URL`, `WORKER_URL`,
      `UPLOAD_TOKEN_SECRET`, `CRON_SECRET`, `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`,
      `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_BASE_URL`, `CONTACT_EMAIL_FROM`, `SITE_NOINDEX`.
- [ ] Note that `SITE_NOINDEX` is still set and `NEXT_PUBLIC_BASE_URL` still points at the apex — both
      get changed in B11. Read the names only; values never go in this file.
- [ ] Confirm Turnstile covers `levelgroundlandscape.com` and `www` (already true) and that the upload
      worker's CORS allows the production origin.

**A3. Proton — owner action**
- [ ] Owner adds `levelgroundlandscape.com` in Proton (Settings → All settings → Domain names → Add
      domain) and sends back: the `protonmail-verification` token, the three DKIM CNAME targets, and
      their DMARC suggestion.
- [ ] Agree the addresses: `contact@levelgroundlandscape.com` plus any aliases (`info@`, `hello@`).
- [ ] Leave the domain sitting unverified — that is expected until the flip.

**A4. Resend — add the domain**
- [ ] Add `levelgroundlandscape.com` (`us-east-1`, custom return-path `send`, **tracking off**, tracking
      subdomain empty). Copy the three records it prints.

**A5. New Cloudflare zone — fill it completely**
- [ ] `CNAME @` and `CNAME www` → the Vercel targets, **DNS only**, TTL Auto (apex is already there).
- [ ] Proton: TXT `@` = `protonmail-verification=<token>`;
      MX `@` 10 `mail.protonmail.ch`, MX `@` 20 `mailsec.protonmail.ch`;
      TXT `@` = `v=spf1 include:_spf.protonmail.ch ~all`;
      CNAME `protonmail._domainkey` / `protonmail2._domainkey` / `protonmail3._domainkey` → the owner's
      targets; TXT `_dmarc` = `v=DMARC1; p=none` (no `rua` yet).
- [ ] Resend: MX `send` 10 `feedback-smtp.us-east-1.amazonses.com`;
      TXT `send` = `v=spf1 include:amazonses.com ~all`; TXT `resend._domainkey` = the `p=…` value.
- [ ] Check: no Google MX, no wildcard `*`, **Email Routing off**, exactly one SPF per name
      (`@` = Proton, `send` = Resend).
- [ ] Copy the two new Cloudflare nameservers somewhere you can read them at the registrar.

---

## Phase B — cutover day (single sitting, quiet hour)

**B1. Pre-flight** — A3–A5 complete; Proton and Resend tabs open; the owner reachable; `dig` available;
know the rollback (C1). Announce the short mail window.

**B2. Flip the nameservers** — Decibite panel → nameservers → replace `renan`/`tori` with the new
Cloudflare pair. If the panel refuses, clear the domain's transfer/update locks first.

**B3. Wait for the zone to go active** — Cloudflare emails you; `dig NS levelgroundlandscape.com`
returns the new pair from 1.1.1.1 and 8.8.8.8. Expect minutes, not hours.

**B4. Confirm the site** — Vercel's domain card → **Valid Configuration**; certificate issues within
minutes. `curl -I https://levelgroundlandscape.com` → 200 from Vercel; load the site and confirm it is
the Next app, not WP Engine. If the cert errors, wait and retry — do not touch records.

**B5. Proton** — **Verify** (TXT lookup) → **Addresses → Add address** → `contact@` (+ aliases) →
send in from an outside address (e.g. Gmail) → reply out → check the received headers show SPF, DKIM
and DMARC **pass**.

**B6. Resend** — **Verify** (DKIM + `send` MX/SPF) → send a real notification (submit the contact form)
→ confirm it arrives and that the From/Reply-To behave.

**B7. App mail wiring** — set `CONTACT_EMAIL_FROM=contact@levelgroundlandscape.com`, update the
`ContactRecipient` row from `levelgrounddev@proton.me` to `contact@…`, redeploy if env changed, submit
one form for real and confirm delivery.

**B8. Leave Google Workspace alone.** Resolvers keep the old delegation for up to ~48 h; mail landing in
the old mailbox stays valid. Do not cancel, do not delete old mail.

**B9. R2 custom domain** — Cloudflare → R2 → the media bucket → Settings → Custom domains →
`assets.levelgroundlandscape.com` (possible now that the zone is active). Wait for status Active;
`curl -I https://assets.levelgroundlandscape.com/<known-key>` → 200.

**B10. Media URL switch** — set `R2_BASE_URL=https://assets.levelgroundlandscape.com` and redeploy,
then rewrite the stored absolute URLs (5 page references + 28 asset rows) with a script; verify every
project page and the lightbox, plus the OG/JSON-LD image URLs.

**B11. SEO and origin** — confirm `NEXT_PUBLIC_BASE_URL=https://levelgroundlandscape.com`; **remove
`SITE_NOINDEX`**; redeploy. Check `robots.txt`, `sitemap.xml`, canonicals, `og:url`/`og:image`, and
that `www` 308s to the apex.

**B12. Full pass** — every public page (all 31 project pages included), admin sign-in and a page save,
media upload/move/delete/reorder/tags, alt regeneration, contact form + Turnstile, lightbox on a phone
(open, expand, rotate, no horizontal scroll), 404 and redirects.

---

## Phase C — first two weeks

- [ ] Keep Google Workspace and the WP Engine origin alive until you are satisfied; then cancel
      Workspace and retire the old site.
- [ ] Watch for mail failures; confirm senders reach `contact@`.
- [ ] Once a week of clean DMARC reports, add `rua=mailto:dmarc@…` and tighten `p=quarantine`.
- [ ] Update `docs/handoff.md` status to "cutover complete", then schedule the Workers migration work
      from `docs/workers-migration-plan.md`.

---

## C1. Rollback

Any time before B5/B6 are verified: put `renan`/`tori` back at Decibite. The old Cloudflare zone is
untouched, so the old site and Google mail return as resolvers re-delegate. Mail already delivered to
Proton in the window stays in the Proton mailbox. Never delete the Vercel project or the old zone.

## C2. What can go wrong, and the tell

| symptom | cause | fix |
|---|---|---|
| Vercel card stays Invalid Configuration after the flip | `www` record missing, or an extra A record at the apex | one record per host, DNS-only, then Refresh |
| Cert warning on the apex | Cloudflare proxy left orange | set the record to DNS only |
| Proton **Verify** fails right after the flip | resolver cached the old delegation | retry after a few minutes; check `dig TXT @1.1.1.1` yourself first |
| Inbound mail bounces right after the MX switch | address not created / domain not verified in Proton | create the address, then retry the sender |
| Contact form delivers nowhere | `CONTACT_EMAIL_FROM` still on an unverified domain, or stale `ContactRecipient` | fix env + row, redeploy, resubmit |
| Images 403 after B9/B10 | `R2_BASE_URL` trailing slash, or the custom domain not Active yet | fix the value, wait for Active, redeploy |
| Old WP Engine site still served | NS flip not saved / locks | re-check `dig NS`, check the registrar saved it |
