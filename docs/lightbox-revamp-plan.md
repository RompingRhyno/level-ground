# Lightbox revamp — plan

Status: **planning** (nothing implemented, nothing committed). Decisions below are settled as of
2026-09-29; ready to build.

## Scope

- **In:** `src/components/sections/GalleryLightbox.tsx` (230 lines today) and the data it now needs.
  It is instantiated in exactly one place, `GalleryClient.tsx`, which is also the lightbox path for
  collection-item galleries.
- **Out:** the admin file lightbox (`src/components/admin/files/Lightbox.tsx`) — untouched. The
  services-gallery page that tag pills will one day link to is its own planning phase; the pills ship
  as plain, non-clickable markup with that hook left open.

## Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                          ×  (close)  │
│  ┌────────────────────── 2/3 ───────────────────┬─────── 1/3 ──────┐ │
│  │ ◀ ╔══════════════════════════════════╗  ▶    │ Project name  [See full project] │
│  │   ║            photo                 ║       │  · tag · tag · tag              │
│  │   ║                            ⤢    ║       │  Project description, which     │
│  │   ╚══════════════════════════════════╝       │  wraps to the panel width and   │
│  │                                              │  scrolls if it runs long.       │
│  └──────────────────────────────────────────────┴───────────────────┘ │
│   [ thumb ] [ thumb ] [ thumb ] [ thumb ] [ thumb ]   ← strip, bottom │
└──────────────────────────────────────────────────────────────────────┘
```

Mobile / narrow: **title panel above, then the photo, then the strip** (the same stack in portrait and
landscape below the split breakpoint). The 2/3 : 1/3 split is `lg` and up.

- **Backdrop: literal `#FFFFFF`** — the only pure-white surface on the public site (the page body is
  the cream `#FAF4F1`). Text inside uses the normal `--color-text-dark` / `--color-text-light`; the
  current `text-white` chrome goes away.
- **Close ×** top right of the overlay, above everything (not inside the photo column).
- **Arrows flank the photo**, left and right. The whole column is the button: a transparent hit area
  the full height of the photo and roughly 96–128px wide, with the glyph centred in it, so there is no
  "missing the arrow". Hover shows a subtle affordance (a circle around the glyph), not the button
  itself. On mobile the arrows overlay the photo's edges with the same large hit areas.
- **Gallery strip stays, at the bottom**, spanning the full width. This replaces today's landscape
  variant, which moves the strip to a right-hand rail (`isLandscape` branches) — one layout shape,
  orientation logic removed.
- **Expanded (zoom): a CSS overlay** that fills the viewport. An expand button sits at the photo's
  top right, and `cursor: zoom-in` over the image does the same thing. In the expanded state the
  cursor is `cursor: zoom-out` and clicking the image minimises back to the two-column view. The real
  Fullscreen API is not used (iOS support is partial and Escape would stop being ours).
- **Escape:** closes the lightbox; when expanded, Escape minimises first (browser convention), then
  closes on the next press.
- Kept from today: body-scroll lock, the touch double-fire guard, thumbnail auto-scroll to the active
  image, transition groups rendering through `TransitionTile`, click-outside-to-close. Keyboard ← / →
  for prev/next is added alongside the arrows.

## Colours

- New token in `src/app/globals.css`:
  `--color-highlight: #c0480c` — `hsl(20 88% 40%)`, i.e. `#c03f0c` shifted 3° toward orange. 5.04:1 on
  white. One step further orange is `#c04e0c` (`hsl(22 88% 40%)`) if the first still reads red.
- **Scope: the gallery strip's active-thumbnail highlight only.** It replaces the pink
  (`--thumbnail-select-color`, `lab(67.38% 42.13 -5.37)`) that the strip's `thumbnail-selected` inset
  ring uses today. The expand button and "See full project" carry ordinary chrome (bordered pill,
  `--color-text-dark` text) — no highlight colour on them. The admin pickers keep the pink; nothing
  outside the lightbox strip changes.

## Info panel (right third)

The lightbox has no folder context today — `Asset` is `{ id, publicUrl, alt }` and the component gets
nothing else. New data, resolved server-side:

- `Gallery.tsx` fetches, for the folders the gallery's assets belong to (each asset's `Asset.folder`
  slug): `name`, `slug`, `description`, and `tags` resolved to `{ slug, name }`.
- Passed as `projects: Record<assetId, { name, slug, description, tags: {slug, name}[] }>` through
  `GalleryClient` into `GalleryLightbox`. One folder row per folder, keyed per asset, so a tag-driven
  gallery spanning several folders shows the right panel per image.
- Panel order (top to bottom): **folder name** with **[See full project]** to its right (a link to
  `/projects/<slug>`), then the **tag pills**, then the **project description**.
- **"See full project" is omitted on the project's own gallery** — `CollectionItemClient` (the
  `/projects/<slug>` detail page) passes `showProjectLink: false`, so the button only appears in
  galleries reached from elsewhere (home, tag galleries, preview).
- A transition group shows the panel for its own folder, same as an image.
- Future hook: pills become links to a services gallery in the next phase — they render as plain pills
  now, so the later change is an `href` plus routing, not a layout change.

## Files touched

| File | Change |
|---|---|
| `src/app/globals.css` | add `--color-highlight` |
| `src/components/sections/GalleryLightbox.tsx` | rewrite: white backdrop, 2/3 + 1/3 (stacked below `lg`: panel → photo → strip), bottom strip, arrows with large hit areas, CSS-overlay zoom, Escape |
| `src/components/sections/GalleryClient.tsx` | thread `projects` + `showProjectLink` into the lightbox |
| `src/components/sections/Gallery.tsx` | resolve folder name/slug/description/tags for the assets it renders |
| `src/components/sections/CollectionItemClient.tsx` | same props through its lightbox path, `showProjectLink: false` (its grid already routes to `GalleryClient` — confirm during implementation) |

No schema, API or migration work. The editor preview renders `GalleryClient`, so it inherits the new
lightbox for free (one component, no preview-drift risk).

## Verification plan

`tsc --noEmit`, then in the browser at 2560 and at phone width: measure the two columns (2/3 : 1/3),
the arrow hit areas (rect width/height), that the strip is bottom-spanning, that the mobile stack is
panel → photo → strip, that Escape closes and de-minimises first, that `cursor` computes to
`zoom-in` / `zoom-out`, and that the strip's active highlight computes to `#c0480c` while the
expand/see-full-project buttons do not use it. Screenshot the open lightbox on a real folder.
