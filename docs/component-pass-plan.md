# Component pass — full-bleed layout + image quality tiers

Status: **approved 2026-09-28, home page first.** Follows the format migration
(`docs/media-migration-plan.md`), which made the masters small enough for this to be worth doing: q95 JPEGs at
original dimensions instead of 16-38 MB PNGs.

## Baseline measured before the pass (2560px viewport, home page)

- Content column **1280px** (`max-w-7xl`) → ~640px of margin per side; half the screen unused.
- Gallery tiles **~384×216**, project cards **~393×221** — the "images are too small" complaint in numbers.
- Banner spans ~2545px already (looser container) and requests the 3840 candidate.
- Every image requests **q75** (Next's default). The optimizer **rejects** an undeclared quality
  (`"q" parameter (quality) of N is not allowed`, `next/dist/server/config-shared.js:656`), so per-component
  quality needs the config list, not just the prop.

## Decisions (approved)

1. **Full bleed**: media sections run edge to edge — no page-edge padding. The gutter is the gap *between*
   tiles (4–16px), not a margin at the screen edge. Text-heavy sections keep a readable measure (≤ ~72ch) so
   prose never stretches across a wide display.
2. **Quality tiers** (`images.qualities: [75, 85, 95]` + a `quality` prop per component):

   | slot | rendered width | quality |
   |---|---|---|
   | full-span, gallery hero, bento-large | 1200–2560 | q95 |
   | half-width: double cells, banner | 600–1200 | q90 |
   | third-width: service cards, project cards, gallery smalls | 380–800 | q85 |
   | admin thumbnails, tiles | ≤400 | q75 (default, unchanged) |

3. **`deviceSizes: 2560`** added. It inserts a candidate between 2048 and 3840; the browser still picks the
   smallest image that covers the slot, so a high-res display keeps getting a high-res image — just not a 1.5×
   oversized one. A 1× QHD screen needs 2560 (was fetching 3840, ~2.25× the pixels); a 2× 1280 screen needs
   2560 exactly. A 2× QHD (5120) still gets the 3840 maximum.
4. **Hero-video player** folded in: poster from the asset's `meta.poster`, `preload="metadata"`, and a
   DPR-based variant pick (720p/1080p from `meta.variants`) instead of one fixed file.
5. **Order**: home page — hero → gallery → services → banner — then collection and detail pages.

## Method per component

1. Change layout (full bleed / columns / gaps) and quality on that component only.
2. Typecheck + build.
3. Measure with resource-timing entries — rendered box vs requested `w`/`q` vs KB transferred
   (`naturalWidth` is density-corrected and misleading for `srcset` images):
   the declared `sizes` string must match what the tile actually renders, or the browser picks a candidate a
   step or two off.
4. Attach a screenshot for the operator's visual judgement.
5. Commit that component before moving on, so any regression is one commit wide.

## Components

| component | layout change | quality | status |
|---|---|---|---|
| `sections/Hero.tsx` | full bleed | q95 | pending |
| `sections/Gallery.tsx` + `GalleryClient.tsx` + `lib/gallery-layout.ts` | full bleed, tile gaps, re-derive cell hints | q95 hero/large, q85 small | pending |
| `sections/Services.tsx` | wider row | q85 | pending |
| `sections/Banner.tsx` | full bleed | q95 | pending |
| `sections/Video.tsx` + `VideoClient.tsx` | full bleed + player work (poster, preload, DPR pick) | q95 poster | pending |
| `sections/TwoColumn.tsx` | half-width media, text measure unchanged | q90 | pending |
| `sections/Contact.tsx` | text section — measure only | — | pending |
| `sections/CollectionIndexPresentation.tsx` (project cards) | wider grid | q85 | pending |
| collection/detail pages (`CollectionItem*`) | full bleed media | q85/q95 by slot | pending |

Admin surfaces are out of scope: their tiles already declare 384px and stay on q75.
