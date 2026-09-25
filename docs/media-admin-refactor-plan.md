# Media Admin Refactor — Plan (draft v1.0)

Self-contained. v1.0 adds video covers (§3.13): the poster captured at upload is used as the thumbnail for
video-only folders and for video tiles in grids.

Context: `/admin/files` is rebuilt so the media library is project-centric (folders = projects), uploads always
target a folder, and no public media consumer breaks. Dataset seen via read-only queries (`.env.local` → Neon):
5 folders, 27 assets, 4 tags, 0 loose assets, 0 MediaUsage rows; `home` carries the only dynamic gallery
(`filters.folder = "2499-larch-st"`) plus a `video` section with a raw R2 URL; prod will grow to ~32 folders.

## 0. Decisions locked

1. Folder delete with contents → allowed behind a destructive confirmation.
2. Rename changes the slug; cascade (§3.3). Unknown/hidden slug → 404 page.
3. No subfolders; before/after grouping deferred.
4. Admin folder grid drag-reorderable → `Folder.order`; `/projects` reads that order; hide-from-/projects per folder.
5. Tag CRUD on the folder page only.
6. Usage guard = warning, not a block; static references only.
7. Upload policy = format-based, no size caps.
8. `/admin/files` renders everything immediately; `/projects` renders all cards at current scale, first page = 48 when it grows.
9. Static references count as usage (§3.4).
10. Hidden folders unreachable from /projects.
11. Upload modal: hide-from-Projects toggle + storage usage (`sum(Asset.size)`).
12. R2 custom domain: deferred.
13. Encoder tuning adopted: `scale=min(1920,iw)` + CRF 26–28 (§3.9).
14. Two variants per video upload (720p + 1080p) + DPR source selection (§3.11); hero clip re-uploaded manually after the player change ships.
15. Usage backfill = idempotent script; revalidation coverage = pure function + unit tests, no UI (§3.12).
16. Playback beacon deferred; interim manual device matrix (§3.11).
17. **Video posters double as folder/tile covers** (§3.13).

## 1. Goals

`/admin/files` = grid of project folder cards styled after the `/projects` listing cards plus admin affordances.
Folder page owns rename/delete/description/tags/assets. Uploads always folder-scoped. No public-site regressions.

## 2. IA

**Main page** — header (title · search · `New folder` · `Upload`); visible folder grid, drag-reorderable; divider +
`Hidden from Projects (n)`; card kebab = Open · Rename · Add files · Hide/Unhide · Delete; per-card OS-file drop
target; empty state.

**Folder page** `/admin/files/<slug>` — `← All projects`; editable H1 (rename → cascade); Hide/Unhide; Delete folder;
description autosave; tag chips + CRUD + counts; asset grid (lightbox, hover-checkbox selection, touch reorder
handle, per-asset kebab, trailing drop zone); selection toolbar; page-level drop zone; usage badges.

**Upload modal** — drop zone + queue, folder picker, per-item progress/retry, close guard, storage readout.
**Move modal** — folder card grid + search, single destination, `from → to` summary.

## 3. Server & data

### 3.1 Ordering + visibility
`Folder.order Int @default(0)`, `Folder.hidden Boolean @default(false)`; backfill from `entityOrder` else
alphabetical; index and detail route exclude hidden.

### 3.2 Reorder API
`POST /api/folders/reorder`; `PATCH /api/folders/[id]` accepts `hidden`.

### 3.3 Rename = cascade
Transaction: name + slug (409 on collision) → `Asset.folder` rewrite → page JSON sweep → revalidate `folders`,
`folder:<old>`, `folder:<new>`, `/projects`, both detail paths, `/sitemap.xml`. R2 keys never re-keyed.

### 3.4 Static-reference usage tracking
Allow-list extractor, normalised URL matching, `@@index([publicUrl])`, reconcile into MediaUsage, admin
`include=usage` + badges + delete warning, orphan audit, tests. Cost: sub-ms + 1 query + ≤10 writes on page save.

### 3.5 Upload policy
Images jpeg/png/webp/avif/gif (heic→jpeg client-side); video mp4/webm/ogg, others transcoded client-side; no size
caps (single `PutObject` ≤ 5 GiB guardrail); server-side re-validation; sanitised keys.

### 3.6 Cache revalidation — fix list (P1)
1. `pathForSlug(slug) = slug === "home" ? "/" : "/" + slug`.
2. Folder mutations revalidate nothing today → `folders`, `folder:<slug>` (both on rename), `/projects`, detail paths, `/sitemap.xml`.
3. Collection-index pages (home reference, `/projects` primary) → `pagesReferencingCollections()`.
4. Asset PATCH only revalidates when `folder` is present → use MediaUsage rows for rename/alt.
5. `global:pages` never busted → include in page mutations.

### 3.7 Discovery / SEO
`app/sitemap.ts` from Prisma + `/sitemap.xml` revalidation; `robots.ts`. Unknown/hidden slug → 404 page.

### 3.8 Contact uploads
Separate validated visitor pipeline; never Asset rows; dead `contact-uploads` branch in `presign/route.ts` → delete.

### 3.9 Video encode pipeline (locked)
One decode → two outputs (720p CRF 28 ≈ 5.9 MB, 1080p CRF 28 ≈ 12.0 MB on the measured hero clip; original upload
was 25.9 MB), `-preset medium -movflags +faststart`, poster frame at ~1 s (1280-wide WebP ≈ 155 KB), variants +
poster recorded in `Asset.meta`, `width/height` stamped. 720p written first.

### 3.10 Storage display
`sum(Asset.size)` (all variants) vs the 10 GB free tier in the upload modal.

### 3.11 Delivery, variants, playback quality
- `need = video.clientWidth × min(devicePixelRatio, 2)` → smallest variant with width ≥ need; optional
  `saveData`/`effectiveType` hints; re-evaluate on resize/orientation; no `<source media>`.
- Player change required (poster + `preload="metadata"` + variant picker); hero clip re-uploaded after it ships.
- Playback telemetry deferred; interim manual device matrix (iPhone Safari, Android Chrome, laptop; throttled + not).
- Images via `next/image`; loading strategy as in §0.8; bucket custom domain deferred.

### 3.12 The scripts, and the coverage check (closed)
- `scripts/reconcile-usage.ts` — usage backfill, idempotent.
- `scripts/audit-media-refs.ts` — orphan audit (read-only).
- Revalidation coverage = pure `revalidationPlan(mutation) → { tags, paths }` + unit tests; optional dev
  `?dryRun=1` and a prod `console.info('[revalidate]', plan)` line.

### 3.13 Video covers / thumbnails (fixes the blank video-folder tile)
**Today's behaviour (verified):** every thumbnail resolver skips non-image mimes —
`lib/folders.ts:getFirstAssetUrlsByFolderSlugs` (`if (asset.mime && !asset.mime.startsWith("image/")) continue`),
and the admin's client-side `folderThumbnails` in `useAdminFiles.ts` does the same. A folder whose first/only asset
is a video therefore gets **no cover**: the admin card renders the grey `bg-gray-700` block and the public card
renders `<div class="absolute inset-0 bg-(--color-bg-secondary)">` — confirmed by fetching `/projects` locally:
the "Videos" card contains no image and no mp4 reference (0 `mp4` occurrences on the page).
Separately, **asset tiles** in the admin grid render `<video preload="metadata">` per tile, which pulls video headers
(R2 Class B ops + bytes) for every video in view and shows a black frame in some browsers until decode.
`next/image` cannot optimize an mp4, so a raw video URL can never be a thumbnail source.

**Fix (uses the §3.9 poster):**
1. Poster is captured at upload and stored in `Asset.meta.poster` (1280-wide WebP) — already planned.
2. Thumbnail resolution becomes **cover resolution** in one shared helper, order:
   first image asset by `orderIndex` → else first video asset's `meta.poster` → else the current placeholder.
   Used by: admin main-grid folder cards, `/projects` index cards (`getFirstAssetUrlsByFolderSlugs` →
   `getFolderCovers`), and the new `GET /api/folders` `firstAssetUrl` field.
3. Admin **asset tiles**: render videos as `<img src=poster>` + a play badge instead of a live `<video>`; only the
   lightbox plays the file. Removes black frames and cuts per-tile metadata fetches.
4. Optional one-off `scripts/backfill-posters.ts`: pull an existing video from R2 locally, grab a frame with ffmpeg,
   upload the poster, PATCH `Asset.meta` — so the current hero clip and any other existing video get covers before
   the manual re-upload happens.
5. Detail pages (`CollectionItem`) stay image-only for the gallery grid by design; a video-only project page can
   optionally render its poster as a cover later — out of scope for now.

Staging: (2) and (3) can ship with P2/P3 (they degrade gracefully while no posters exist); (1) and (4) ride with the
P4 encoder work.

## 4. API surface (delta)

| Endpoint | Change |
| --- | --- |
| `GET /api/assets` | additive `include=usage`, `folder=__none__`, `q`, `kind`, `sort`, `limit`/`offset` |
| `POST /api/assets` | folder required; mime allow-list; sanitised key; variants + poster + width/height in `meta` |
| `POST /api/assets/batch-move` | wire into move modal + drag&drop |
| `GET /api/assets/usage` (or `include=usage`) | used-on data for badges + delete modal |
| `GET /api/storage` | library bytes (DB sum), cached |
| `GET /api/folders` | `assetCount`, `coverUrl` (image or poster), `order`, `hidden`, `tags` |
| `PATCH /api/folders/[id]` | rename cascade, `hidden`, revalidation incl. sitemap |
| `POST /api/folders/reorder` | new |
| `DELETE /api/folders/[id]?contents=delete` | assets (R2 + rows) then folder; summary; revalidation |
| `/api/tags` | add `PATCH` |
| `app/sitemap.ts`, `app/robots.ts`, `revalidationPlan()`, `pathForSlug()`, `pagesReferencingCollections()`, `resolveCover()` | new |

## 5. Consumer impact matrix

| Consumer | Depends on | Risk | Mitigation |
| --- | --- | --- | --- |
| `/projects` index + detail | folder order/slug/name/tags/cover | rename/hide must propagate; video-only folders blank today | cascade, §3.6, 404 page, sitemap, §3.13 |
| Page JSON folder pins | `gallery.filters.folder` (home pins `2499-larch-st`) | rename silently empties a gallery | cascade sweep + audit |
| Gallery dynamic | mime-agnostic query (videos → broken `<img>`) | pre-existing | filter non-image mimes |
| Static refs (hero/twoColumn/banner/services/contact/video/entityImages) | literal URL strings | delete leaves 404s, no warning today | §3.4 + warning + audit |
| Video sections | `videoUrl` + `meta.variants`/`meta.poster` | variant served only after the player change | ship player change with P4 |
| Pickers (Image/Video/Gallery/SectionEditor/Preview) | `GET /api/assets` bare array, `?folder=` | drift; 200-row cap | additive-only changes |
| Contact uploads | `contact-uploads/` prefix + Worker | admin rules must not apply | validate only admin paths |

## 6. Phases

- **P0** foundations: toasts, hooks, `FolderCard`, modals, query-param routing.
- **P1** order/hidden migration, `/api/folders` deltas (+ `coverUrl`), §3.6 revalidation + tests, `/projects` order+hidden+cover, sitemap+robots, 404 page.
- **P2** main page grid: render-all, reorder, hidden section, create, search, drop-to-upload, eager first rows, cover fallback.
- **P3** folder page: back, rename cascade, delete-with-contents, description, tag CRUD, selection, move modal, reorder, drop zone; video tiles as poster images + play badge.
- **P4** upload modal + encoder tuning + two variants + poster capture + width/height + storage display + key sanitisation; player change (poster + DPR picker); delete dead presign branch; optional `backfill-posters.ts`.
- **P5** reference tracking: extractor, resolver, reconcile + backfill, `@@index([publicUrl])`, badges, warnings, audit, tests.
- **P6** compatibility pass over §5.
- **P7** polish: a11y, alt text, lightbox metadata, skeletons, responsive, tokens, empty states.
- **After P4** manual device matrix; **future**: R2 custom domain, playback beacon, Cloudflare Stream, before/after grouping, hero-clip re-upload.

## 7. Verified findings

1. Video reference intact (`home.sections[1].videoUrl` === asset `891c35dc…publicUrl`; ranged GET → 206); moves write only `folder`/`orderIndex` to Neon.
2. Live orphan: `home.services[1].image` → 404, no Asset row.
3. Usage blind spot: only static galleries were scanned; 0 rows.
4. Home gallery pins `filters.folder = "2499-larch-st"`; dynamic galleries don't filter mime.
5. No folder-mutation revalidation; `/` never revalidated; `global:pages` never busted.
6. Admin uploads unvalidated in shape but converted client-side; keys contain raw spaces; source-res CRF 23 encode → 25.9 MB for a 23 s clip.
7. `orderIndex = null` on 2 assets.
8. Contact uploads: separate, validated, cron-cleaned pipeline.
9. No `sitemap.ts` / `robots.ts`.
10. R2 free tier 10 GB-month; all stored `publicUrl`s use the `r2.dev` dev domain; `Asset.width/height` never populated.
11. `next-video`'s non-Mux providers do no transcoding; Cloudflare Stream is minutes-priced.
12. Measured encode and poster sizes (§3.9, §3.11).
13. Video-only folders have no cover on the public index either: `/projects` renders the "Videos" card with the empty placeholder and zero mp4 references (§3.13).

## 8. Remaining questions

None blocking. Optional: dev `?dryRun=1` param and prod revalidate log line (§3.12); playback beacon later (§3.11);
`backfill-posters.ts` for existing videos before the manual re-upload (§3.13).
