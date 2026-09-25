# Media Admin Refactor — Plan & Status (v1.1)

Implemented on `master`, unpushed. Each phase below maps to commits; the section after records what
is deliberately still open.

## Status by phase

| Phase | State | Commits |
| --- | --- | --- |
| **P0** foundations (toasts, hooks, modals, query-param routing) | done | `feat(admin): rebuild the media admin around project folders` |
| **P1** order/hidden migration, folder API deltas, revalidation fixes, `/projects` order+hidden, sitemap+404 | partly done — sitemap/robots still open | `feat(db): …`, `fix(cache): …`, `feat(media): folder ordering…` |
| **P2** main page grid (render-all, reorder, hidden section, create, search, drop-to-upload) | done | `feat(admin): rebuild…` |
| **P3** folder page (back, rename cascade, delete-with-contents, description, tag CRUD, selection, move modal, reorder, drop zone) | done | `feat(admin): rebuild…` |
| **P4** upload modal (folder required + hide toggle, storage display, key sanitisation, width/height, poster) | done | `feat(media): browser-rendered video variants…` |
| **P4b** player change (poster + DPR variant picker) | **open** | — |
| **P5** reference tracking (extractor, reconcile, backfill, audit) | done — badges/warnings wired, `@@index([publicUrl])` still open | `fix(cache): …`, `chore(scripts): …` |
| **P6** compatibility pass | done for public routes (see verification) | — |
| **P7** polish (a11y, skeletons, responsive) | partly done | `feat(admin): rebuild…` |

## What was built

**Data / API**
- `Folder.order` + `Folder.hidden` (migration `20260925223545`), backfilled from legacy `entityOrder`
  then alphabetically (`scripts/backfill-folder-order.ts`, re-runnable).
- `lib/revalidate.ts`: one `revalidationPlan(mutation) → { tags, paths }` used by every mutation route,
  fixing the `/home` path bug, the missing folder revalidation and the never-busted `global:pages` tag.
  Emits a `[revalidate]` log line per mutation.
- `lib/media-refs.ts`: static media references (hero/banner/video/services/contact/collection-index
  `entityImages`) are resolved to asset IDs and recorded in `MediaUsage` alongside static gallery IDs;
  `reconcileMediaUsage` rebuilt per page. Used for precise revalidation, "used on" badges and delete warnings.
- `lib/folders.ts`: display order + hidden filtering, folder cards (cover + asset count), cover resolution
  that falls back to a video poster, and the rename cascade (`rewriteFolderSlug` for page JSON).
- `api/folders`: cards GET, create POST (order assigned), PATCH (rename cascade + hidden + tags +
  description), `POST /reorder`, DELETE with `?contents=delete` (R2 objects, MediaUsage rows, assets).
- `api/assets`: folder required, mime allow-list, sanitised `media/<folder>/<ts>-<name>` keys,
  `?include=usage`, `/usage`, `POST /presign/batch` validating folder + types, `/api/storage` reading
  `sum(Asset.size)` against the 10 GB free tier.
- `api/tags` PATCH for tag rename (display name only; the slug is the public query key).

**Site**
- `/projects` reads the manual order, hides hidden folders, and uses image-or-poster covers.
- Project detail route `notFound()`s for missing/hidden folders; new `(site)/not-found.tsx` with links back.

**Admin UI** (`src/components/admin/files/*`)
- Folder card grid (`AdminFilesClient`) with search, create, drag reorder, hidden section, per-card
  drop-to-upload, kebab actions.
- Folder page (`FolderPageClient`) with back link, click-to-rename heading, hide/unhide, delete-with-contents,
  autosaving description, tag CRUD, file grid with selection → Move/Delete, drag reorder, lightbox
  (metadata, copy URL, download, prev/next), rename + alt dialogs, per-file kebab.
- `UploadModal` (folder mandatory, inline folder create with hide toggle, browser-side HEIC→JPEG and
  video→720p/1080p+poster, per-file progress/retry, storage readout) and `MoveModal` (folder thumbnails).
- Toast provider replaces silent `console.error` failures; `AlertDialog` confirmations state what is
  used where before destructive actions.

## Verification performed

- `npx tsc --noEmit` clean; `npm run build` succeeds (route table includes `/api/folders/reorder`,
  `/api/storage`).
- Migration applied to the Neon database; `Folder.order` backfilled (`2499 Larch St.`, `W. 10th Ave`,
  `Assets`, `Example Folder`, `Videos`).
- `scripts/reconcile-usage.ts` run: MediaUsage now populated from page saves (home, contact, …).
- `scripts/audit-media-refs.ts --check-r2` run: 1 orphan reference confirmed —
  `home.services[1].image` → HTTP 404, no asset row (pre-existing, not caused by this work).
- Production server smoke test of the public routes: `/` 200, `/projects` 200 (cards in the new manual
  order), `/projects/2499-larch-st` 200, unknown slug → 404 page. Admin routes require a session, so the
  admin UI was verified by type-check/build and its data layer only.
- Note for the running dev server: the media admin work deleted `.next/types` while `next dev` was live,
  which wedged that process (it serves 500s). Restarting `npm run dev` clears it — the same code answers
  200 from `next start`.

## Still open (deferred by decision)

1. **Player change**: `video` section to render `poster` + `preload="metadata"` and pick the 720p/1080p
   variant by `clientWidth × min(devicePixelRatio, 2)`; then re-upload the hero clip so it gains renditions
   and a poster (and re-pick it in the page editor, then delete the old 26 MB asset).
2. `app/sitemap.ts` + `robots.ts` (folders are crawlable via card links today, but lazy-loading plans make
   a sitemap the durable discovery path).
3. R2 custom domain (all stored URLs still on the `r2.dev` dev domain).
4. `@@index([publicUrl])` on Asset (resolver currently scans; trivial at current size).
5. Playback metrics beacon (sampled `sendBeacon`) — deferred until there is traffic worth measuring.
6. Data hygiene: `Example Folder`, `Assets`/`test` folders are test junk; the hero clip's renditions;
   video posters for the existing video asset (until re-uploaded, the "Videos" card has no cover).
7. Optional: dev `?dryRun=1` for mutation plans; `before/after` grouping; Cloudflare Stream if real
   walkthrough videos appear.
8. `npm run lint` fails repo-wide on `@typescript-eslint/no-explicit-any` — pre-existing (e.g.
   `sections/Gallery.tsx`), not introduced here; new code follows the same house style.
