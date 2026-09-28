# Component pass — full-bleed layout + image quality tiers

Status: **executed 2026-09-28.** Follows the format migration (`docs/media-migration-plan.md`), which made the
masters small enough for this to be worth doing: q95 JPEGs at original dimensions instead of 16-38 MB PNGs.

## Baseline measured before the pass (2560px viewport, home page)

- Content column **1280px** (`max-w-7xl`) → ~640px of margin per side; half the screen unused.
- Gallery tiles **~384×216**, project cards **~393×221** — the "images are too small" complaint in numbers.
- Banner spans ~2545px already (looser container) and requests the 3840 candidate.
- Every image requests **q75** (Next's default). The optimizer **rejects** an undeclared quality
  (`"q" parameter (quality) of N is not allowed`, `next/dist/server/config-shared.js:656`), so per-component
  quality needs the config list, not just the prop.

## Decisions (approved)

1. **Full bleed**: media sections run edge to edge — no page-edge padding at all. The gutter is the gap
   *between* tiles (16px), not a margin at the screen edge. Text-heavy blocks keep their own padding and a
   readable measure (≤ ~72ch) so prose never stretches across a wide display.
2. **Quality tiers** (`images.qualities: [75, 85, 90, 95]` + a `quality` prop per component):

   | slot | rendered width | quality |
   |---|---|---|
   | full-span, gallery hero, bento-large | 1200–2560 | q95 |
   | half-width: double cells, banner, two-column media | 600–1200 | q90 |
   | third-width: service cards, project cards, gallery smalls | 380–800 | q85 |
   | admin thumbnails, tiles | ≤400 | q75 (default, unchanged) |

3. **`deviceSizes: 2560`** added. It inserts a candidate between 2048 and 3840; the browser still picks the
   smallest image that covers the slot, so a high-res display keeps getting a high-res image — just not a 1.5×
   oversized one. Measured: the banner (2545 span) now takes 2560 instead of 3840; a 2× QHD display still gets
   the 3840 maximum.
4. **Hero-video player** folded in: poster from the asset's `meta.poster`, `preload="metadata"`, and a
   client-side rendition pick (`innerWidth × dpr > 1600` → 1080p, else 720p) with the stored original as the
   fallback when an asset has no captured variants.
5. **Hero reworked** into a full-bleed image: a band (min 420px, 560px from md) with the copy and CTA over it
   behind a left-to-right scrim; the neutral panel plus normal heading colour when no image is set.

## Progress

- **Container + config + hero circle** (`ad916a4`): `.section-container` in `globals.css` used by both
  renderers (replacing eight copies of `mx-auto max-w-7xl px-6 py-20`); `qualities` + a 2560 `deviceSize` in
  `next.config.ts`. Measured at 2560: sections 2545 (were 1265).
- **Project cards** (`8caa8a8`): operator-reported "pixelated recent projects thumbnails". Cause: the card's
  `sizes` still said `384px` from the capped layout, so a card rendering 809px fetched the 384 candidate.
  Now `33vw` + q85 — verified on `/` and `/projects`: 809px card, 1080 candidate, complete.
- **Video** (`d011b6f`): full-bleed player, poster + `preload="metadata"` + rendition pick. Verified at 2560:
  `src` = `…-1080p.mp4`. Also removed the last edge inset from `.section-container` (the approval was explicit
  that the gutter is the gap between images, not padding at the screen edge).
- **Home-page sections** (`d877e85`): galleries (both paths), services, banner (q95, `priority` dropped — it
  sits below the fold), contact. Gallery tiles 838px → 1080@q85, hero tile 2545px → 2560@q95; banner 2545 →
  2560@q95.
- **Two-column, collection item, index heading** (`c1fddc5`): full-bleed detail tiles with the `sizes` they
  never had (both grid paths), text blocks padded since the wrapper no longer pads, two-column media grown
  from a 256px strip to 16:9 at q90.
- **Hero** (`this commit`): reworked into a full-bleed image band.
- Content note: the **hero and services images are empty** in the database (both render their neutral
  placeholder), so the design can only be judged once those are re-picked. Everything else on the home page is
  real content. Asset masters are fine: 253 of 254 assets are ≥1600px wide, the exception being
  `test/rain-barrel.jpeg` (1100×734).

## Method per component

1. Change layout (full bleed / columns / gaps) and quality on that component only.
2. Typecheck. **Do not run `npm run build` while the live dev server is up** — it writes `.next` under it, and
   after a few builds the dev server was observed serving a stale compiled `globals.css` (its chunk still had
   the removed `padding-inline`, `Cache-Control: no-cache` so server-side, while the file on disk was correct).
   It recovered only on a dev-server restart. Use the scratch-copy recipe in the `level-ground` skill.
3. Measure with resource-timing entries — rendered box vs requested `w`/`q` vs KB transferred. `naturalWidth`
   is density-corrected and reports roughly the CSS width, so it cannot tell you which candidate loaded.
4. Attach a screenshot for the operator's visual judgement.
5. Commit that component before moving on, so any regression is one commit wide.

## Components

| component | layout change | quality | status |
|---|---|---|---|
| `sections/Hero.tsx` | reworked: full-bleed image band, copy + CTA over a left-to-right scrim | q95 | **done** |
| `sections/Gallery.tsx` + `GalleryClient.tsx` | full bleed, 16px gutter, both paths identical | q95 hero/large, q85 small | **done** |
| `sections/Services.tsx` | full-bleed two-column grid, heading measure | q85 | **done** (card images empty in the DB) |
| `sections/Banner.tsx` | already full span; `priority` removed | q95 | **done** |
| `sections/Video.tsx` + `VideoClient.tsx` | full bleed + player work | q95 poster | **done** |
| `sections/TwoColumn.tsx` | full-bleed half-width media, text measure | q90 | **done** |
| `sections/Contact.tsx` | full-bleed container, heading measures, circle at q85 | q85 | **done** |
| `sections/CollectionIndexPresentation.tsx` (project cards) | wider grid + heading padding | q85 | **done** |
| collection/detail pages (`CollectionItem*`) | full-bleed media + padding for the text blocks | q85 | **done** |

Admin surfaces are out of scope: their tiles already declare 384px and stay on q75.

## Remaining

- Preview parity: `PreviewClient`'s own inline gallery/video/contact markup still carries `max-w-7xl px-4`
  containers in a couple of places. Invisible while the preview pane is narrower than 1280px; align them when
  the pane is widened.
- Operator content: re-pick the hero image and the two service card images.
