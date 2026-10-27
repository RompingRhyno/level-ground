# Cloudflare Workers migration plan

Status: **draft, 2026-10-26.** Spike complete (build + bundle measured); nothing in the app has been
changed yet. Companion document: `docs/handoff.md` (accounts, secrets, cutover order) — this file only
covers moving the **hosting** from Vercel to Cloudflare Workers.

Decision being evaluated: **Workers Paid ($5/mo)** instead of **Vercel Pro ($20/mo)**. Vercel Hobby is
not an option for a client site (non-commercial use only), so the real comparison is $5 vs $20.

## What the spike proved

Run on this machine with `@opennextjs/cloudflare` 1.20.13 + `wrangler` 4.152.0, Next build from
`master` at `209ac8b`.

| check | result |
|---|---|
| Build through the adapter | **passes**, but only after swapping Prisma's driver (below) |
| Worker bundle | **18,324 KiB raw / 4,496.74 KiB gzip ≈ 4.4 MiB** |
| Free-plan bundle limit (adapter docs) | 3 MiB → **does not fit** |
| Paid-plan bundle limit | 10 MiB → fits with ~5.5 MiB headroom |
| Static assets (separate) | 57 files / 2.9 MB |
| Middleware | adapter warns **"Node.js middleware support is experimental"** — this app's auth gate |
| Prisma with `@prisma/adapter-pg` | **build fails**: `pg/lib/stream.js` → `Could not resolve "pg-cloudflare"` |
| Prisma with `@prisma/adapter-neon` | builds clean, `tsc --noEmit` clean |

Bundle attribution (OpenNext's own esbuild metafile, `handler.mjs.meta.json`):

| contributor | minified | share |
|---|---|---|
| Prisma generated client (`.prisma`) | 4.73 MiB | ~35% |
| Next.js server runtime (`next`) | 2.09 MiB | ~15% |
| `heic2any` (browser-only, leaking into the server graph) | 1.29 MiB | ~9.5% |
| AWS SDK family (`@aws-sdk/*`, `@smithy/*`, `@aws-crypto/*`) | ~1.0 MiB | ~7.5% |
| the app's own SSR chunks | ~2.5 MiB | ~18% |

Cost of the render that follows an invalidation (PUT each page unchanged → `revalidateFor()` → time the
next GET; local Node, `next start`, CPU from `/proc`):

| page | render CPU | DB queries | wall | HTML |
|---|---|---|---|---|
| `/` | 150 ms | 14 | 622 ms | 126 KiB |
| `/landscape-design-installation` | 80 ms | 38 | 406 ms | 390 KiB |
| `/landscape-maintenance` | 70 ms | 11 | 149 ms | 126 KiB |
| `/about` | 20 ms | 5 | 78 ms | 35 KiB |
| `/projects` | 20 ms | 11 | 185 ms | 107 KiB |
| `/contact` | 10 ms | 5 | 69 ms | 26 KiB |

Average **58 ms CPU / 14 queries** (40 ms excluding the home page's cold-chunk outlier). Public cache
hits are 0.5–3.0 ms with 0 queries; 45 routes are prerendered, 31 of them project pages.

## Decisions this settles

1. **Workers Paid is required.** Free's 10 ms CPU cannot complete a page render (10–150 ms) or an admin
   render (11–17 ms), so content edits and admin use would fail. The bundle also exceeds Free's 3 MiB.
2. **`@prisma/adapter-neon` is mandatory.** The `pg` driver cannot be bundled for Workers at all.
3. **Keep R2; do not adopt "Cloudflare Images" the storage product.** Image resizing comes from
   **Transformations** on the R2 custom domain — no re-upload, no URL rewrite of stored objects.
4. **Durable Objects stay SQLite-backed** (Free-supported, so no extra plan needed for the cache/queue).
5. Bundle trims (`heic2any`, AWS SDK) are **performance** work, not eligibility work — do them for cold
   starts, not to reach a free tier that still can't render.

## Scope — new files

| file | purpose |
|---|---|
| `open-next.config.ts` | `defineCloudflareConfig({})`: R2 incremental cache (reuse the media bucket under a `cache/` prefix), DO queue, sharded tag cache (the default build already emits `sharded-tag-cache` + `bucket-cache-purge`) |
| `wrangler.jsonc` | worker name; `nodejs_compat`; `assets` binding; R2 cache binding; DO bindings + `new_sqlite_classes` migrations; service binding to itself; `placement: { mode: "smart" }`; cron trigger; plain vars; `observability.enabled` |
| `src/lib/image-loader.ts` | custom `next/image` loader → `/cdn-cgi/image/...`; returns `src` unchanged in `next dev` |

## Scope — app changes (8 files)

| file | change | reason |
|---|---|---|
| `src/lib/prisma.ts` | `PrismaPg` + `pg` → `PrismaNeon` | proven: `pg` cannot bundle |
| `src/lib/r2.ts` | `@aws-sdk/client-s3` → `aws4fetch` (Put/Get/Delete/List) | Node http stack is wrong for Workers; also −0.3 MiB gzip |
| `src/app/api/assets/presign/batch/route.ts` | presign via `aws4fetch` (`AWS4.sign`) | must produce the same URL shape the upload worker expects |
| `src/app/api/contact/cleanup/route.ts` | same swap | cron path |
| `next.config.ts` | `images: { loader: "custom", loaderFile: "./src/lib/image-loader.ts" }` | no `sharp` on Workers; Transformations replaces the optimizer |
| `vercel.json` | retired; cron moves to `wrangler.jsonc` | Vercel crons don't exist on Workers |
| `src/proxy.ts` (middleware) | verify as-is; fall back to layout/`requireSession()` gating if broken | adapter flags Node middleware as experimental |
| `FileUploader.tsx`, `Contact.tsx` | wrap `heic2any` in a `next/dynamic({ ssr: false })` client-only component | drops 1.3 MiB (9.5%) from the server bundle |

Untouched: schema and data, R2 objects, Turnstile, Resend, the upload worker, all UI, the DNS/domain
cutover order, `docs/handoff.md`'s account inventory.

## Image pipeline

`next/image` keeps its API; only the emitted URLs change:

```
/_next/image?url=…&w=640&q=75   →   /cdn-cgi/image/width=640,quality=75,format=auto,fit=scale-down/<source path>
```

- `sizes`, `fill`, `priority` keep working — Next builds `srcset` through the loader.
- **Local dev has no `/cdn-cgi/image`**, so the loader must return the bare URL when
  `process.env.NODE_ENV === "development"`; otherwise every image 404s in `next dev`.
- Zone: enable **Transformations** on the same Cloudflare zone as the R2 custom domain.
- Cost: unique transformations per month — first 5,000 on the Images metric, then $0.50/1,000. This
  site's ~254 assets across the widths actually requested should land in the low thousands.
- Unaffected: `<video>` (plain R2), OG/JSON-LD image URLs (raw R2, by design), the lightbox's
  natural-size measurement (reads the loaded `<img>`).
- Verify: AVIF/WebP negotiation, one heavy gallery page's LCP, admin thumbnails at the right sizes,
  `srcset` baked into the 45 prerendered pages.

## Infrastructure, secrets, pipeline

- **Secrets** (Worker secrets, values never in the repo): `DATABASE_URL`, `R2_ACCOUNT_ID`,
  `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`,
  `UPLOAD_TOKEN_SECRET`, `CRON_SECRET`.
- **Vars**: `R2_BUCKET_NAME`, `R2_BASE_URL`, `WORKER_URL`, `NEXT_PUBLIC_BASE_URL`,
  `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `CONTACT_EMAIL_FROM`.
  `NEXT_PUBLIC_*` are inlined at build time — they must exist in the **build** environment, not only at
  runtime.
- **Deploy**: Workers Builds on the GitHub repo (simplest) or GitHub Actions with
  `npx opennextjs-cloudflare build && npx wrangler deploy`. Token needs Workers Admin + R2 (bucket
  create) + the zone once it exists — see `docs/handoff.md`.
- **Cron**: `scheduled` handler (or a fetch to `/api/contact/cleanup` with `CRON_SECRET`) replacing
  `vercel.json`'s daily trigger.
- **Custom domain**: attach `levelgroundlandscape.com` + `www` to the Worker at cutover; keep the Vercel
  project deployed and the DNS records untouched until the switch is verified.
- **Observability**: `wrangler tail` for the CPU table below; Workers Logs for error rates.

## Work order

1. **Adapter + build** (branch): install adapter/wrangler, add config files, Neon adapter, deploy to
   `workers.dev`. Accept: build passes, bundle size reported, all prerendered pages render, no 500s.
2. **Data + storage**: `aws4fetch` in the three server files; verify presign parity (URL shape, expiry,
   content-type), upload → R2, delete, batch move, reorder.
3. **Images**: loader + zone Transformations. Accept: `srcset` on `/cdn-cgi/image`, AVIF/WebP, admin
   thumbnails, dev bypass.
4. **Admin + auth on Workers**: sign-in/out, session cookie, page save (revalidation visible within a few
   seconds), media CRUD, tag editing, alt regeneration. Accept: no CPU-limit errors in `wrangler tail`.
5. **Mail + cron**: contact form (Turnstile → Resend → recipient row), contact uploads, cleanup cron fires
   and deletes expired uploads.
6. **Full pass** on the deployed preview, collect the `wrangler tail` CPU/latency table, then rewrite the
   hosting sections of `docs/handoff.md` and switch the domain at the planned cutover.

## Verification checklist

- Public: `/`, all 31 project pages, `/projects`, `/landscape-design-installation`,
  `/landscape-maintenance`, `/about`, `/contact` — 200, correct canonical, no hydration warnings.
- Caching: a page save appears live within seconds; a folder rename updates galleries; ISR expiry
  re-renders without errors in `wrangler tail`.
- Admin: sign-in, session survives navigation, page editor save + preview parity, media upload
  (including a HEIC), move/delete/reorder, tag add/remove, folder rename, alt regeneration.
- Mail: contact notification arrives; admin password-reset mail sends once the domain is verified.
- Cron: `/api/contact/cleanup` runs on schedule and returns 200.
- SEO: `sitemap.xml`, `robots.txt`, OG image URLs, JSON-LD, 404 and redirects.
- Mobile: lightbox open/expand/rotate, no horizontal scroll, thumbnail strip.
- Performance: p50/p95 TTFB from a North American and a European vantage; LCP on the heaviest gallery.

## Risks and unknowns

| risk | mitigation |
|---|---|
| Node middleware is experimental → auth gate may misbehave | every admin API route already calls `requireSession()`; worst case drop the middleware and gate in the admin layout |
| `aws4fetch` presign URL must match the upload worker's expectations | compare a presigned URL byte-for-byte with today's SDK output before cutover |
| Dynamic renders from distant PoPs cross the ocean to Neon (us-west-2), 5–38 queries per render | `placement: { mode: "smart" }` (DO placement is automatic); measure p95 from Europe before the flip |
| DO tag cache / revalidation path differs from `revalidatePath` semantics | end-to-end save → live test, plus a folder rename test |
| Image loader must be deterministic at build (45 prerendered `srcset`s) | loader takes no host-dependent input; dev bypass by `NODE_ENV` |
| Bundle growth later re-approaches 10 MiB | keep Prisma as the only large dep; do the `heic2any`/AWS trims |

## Expected performance vs Vercel Hobby/Pro

Honest expectation: **a wash for visitors, not a win.**

- Public pages are prerendered and edge-cached on both platforms; TTFB differences are tens of
  milliseconds at most. Cloudflare has more PoPs; Vercel's cache is already excellent.
- Dynamic paths (admin, cache misses, revalidations) are the risk: Vercel runs functions in one region
  next to Neon (us-west-2), while Workers run where the request lands — 5–38 queries × intercontinental
  RTT can dominate. Smart Placement closes most of that gap but needs traffic to learn.
- Cold starts favour Workers (isolates vs serverless functions), but public traffic rarely hits a cold
  path because pages are cached.
- Images: Vercel's `sharp` optimizer vs Cloudflare Transformations — comparable; measure LCP.
- Media bytes come from R2 either way, so bandwidth limits aren't the differentiator.
- The real gains are **cost ($5 vs $20)** and **one vendor** for DNS, CDN, media, images and app.

## Cost

| item | monthly |
|---|---|
| Workers Paid | $5.00 |
| R2 storage/egress | $0 within the free tier (10 GB, no egress fees) |
| Transformations | $0–2 (first 5,000 unique free, then $0.50/1,000) |
| Neon | unchanged |
| **total** | **≈ $5–7** vs Vercel Pro $20 |

## Open questions

- Workers Builds or GitHub Actions? Builds is simpler; it needs repo install access.
- Do the `heic2any` / AWS trims before launch or after? They only affect cold-start time.
- Does the owner ever intend to use the admin on the public site? (No effect on the plan price — Paid is
  required either way — but it decides whether the admin needs production-grade polish at cutover.)
