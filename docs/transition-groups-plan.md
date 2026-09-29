# Before/After transition groups

Status: **draft for review — not implemented.** Nothing here is code yet; this is the artifact to red-line
before implementation starts. Companion to `docs/media-admin-refactor-plan.md` (the admin surfaces) and
`docs/component-pass-plan.md` (the public rendering rules).

## What it is

A **transition group** is a first-class gallery item: one tile, one lightbox stop, that cycles 2–6 images with
a chosen animation. It is created and managed from a folder in the media manager, occupies one slot in the
folder's order like any image, and renders at the same dimensions a normal image would in that slot. Its
purpose is before/after presentation, with the "before" shots typically hidden so they do not also appear as
tiles of their own.

## Data model

- **A group is an ordinary `Asset` row** whose `meta.transition` describes it:

  ```json
  { "members": ["<assetId>", "..."], "animation": "crossfade", "animateMs": 500, "holdMs": 2000 }
  ```

  It then inherits the file list, `orderIndex` + the folder lock, drag reorder, both pickers, `MediaUsage` and
  the delete guard without new endpoints. `storageKey` / `provider` hold the **first member's** values as the
  row's representative; `width` / `height` hold the first member's (the group's aspect); `alt` holds the name;
  `publicUrl` holds the first member's URL so existing sweeps have something to resolve; `size` stays null.
  `mime` is `image/x-transition`, which keeps it inside the `image/*` filters that dynamic galleries and the
  image pickers already apply.
- **`Asset.hidden Boolean @default(false)`** — new column, migration + `npx prisma generate`.
- **Hiding also moves the asset to the end of the order** (`orderIndex` after the current maximum). This is
  what keeps `pickCover` from ever choosing a hidden "before" shot, without a special case in the cover
  resolver. Unhiding appends at the end too — the previous position is not restored.
- **Transition groups are never a cover.** `pickCover` skips rows with `meta.transition`; if every candidate
  in a folder is a group or hidden, the card falls back to the neutral placeholder.

## Rules for a group

- **2 to 6 members**, chosen at creation from a single selection in one folder. The server refuses to save a
  group with fewer than 2; a 1-member group must never exist.
- No nesting: a member cannot itself be a group.
- Members normally live in the group's folder. A later move of a member out of the folder is allowed (with the
  warning below) and the group keeps the member — the renderer resolves members by id, not by folder.
- **A hidden image may be a member.** Hidden means "no tile of its own", not "unavailable to a group".
- **2 → 1 dissolves the group**: if a member is deleted or moved out of a 2-member group, the group row is
  deleted and its `meta.transition` goes with it. (The surviving member keeps its own row, so nothing is
  duplicated and no object is orphaned.)
- **Delete and move of a member** warn through the shared confirm dialog ("used in transition group …"), with
  *confirm anyway* and *cancel*. Confirming a delete from a 3+ group removes the member and keeps the group.
- **Name is generated, not editable**: "Before/After 1", "Before/After 2", numbered per folder.
- A group is **deletable** from the modal's list and through the normal selection + Delete selected. No rename.

## The modal

Opened from the folder toolbar. Contains, top to bottom:

1. **Existing groups in this folder**, selectable to edit; delete available here.
2. **The member strip**: selected images as thumbnails, drag-reorderable, followed by a dotted-line placeholder
   that prompts for the next image. With 2+ files selected when the button was pressed, the strip is
   pre-populated. **No adding inside the modal** — membership is decided by the selection before opening; the
   modal's list is authoritative once open (removing a member is allowed, adding without a re-selection is not).
3. **Animation type**: crossfade, slide, wipe, fade-to-black. (Others can be added later; no interactive
   drag-style slider.)
4. **Animation duration** (`animateMs`) and **hold per image** (`holdMs`): numeric fields, typable, with
   −/+ steppers in 250ms steps.

Toolbar button behaviour: **"Create transition…" is greyed out until 2 or more files are selected**, with a
tooltip explaining the requirement. In the folder-less views (the root "All" listing, search results) the
button is absent — a group belongs to a folder.

The toolbar order is as specified: `Select all, Create transition…` with nothing selected; `Select all, Clear,
Hide, Create transition…, Move to…, Delete selected` with a selection.

## Rendering

- One shared tile component renders a group everywhere: the admin file list, the gallery grids, the lightbox.
  A group in the file list shows the transition as configured, and loops always (a folder will not hold 30 of
  them).
- **Payload**: the tile requests every member at the slot's size and quality tier (a hero group is 2–3 ×
  2560px at q95 — accepted). **The cycle does not start until all members are loaded**, holding on the first
  image; until then the tile is the first member's image, which is also what `sizes` optimises for.
- **Playback**: animates while in view, pauses off-screen. `prefers-reduced-motion` renders a single static
  frame (the after image) with no cycle.
- **Progression dots**: one pill per member at the bottom of the lightbox tile; the active one enlarges.
  Hovering a pill shows that member and pauses the cycle until the pointer leaves. Keyboard focus mirrors
  hover.
- **Masonry** uses the first member's aspect. Masonry is otherwise out of scope for now.
- Static (hand-picked) galleries render groups; hidden assets still render there, and still appear in the
  pickers.

## Hide

- Hidden assets render in a **separate collapsible section at the top of the folder's file list**, collapsed by
  default, remembered per folder — the same pattern as the hidden-folders panel.
- The section's cards offer **Unhide**; the toolbar button reads **Hide** or **Unhide** depending on the
  selection.
- **A mixed selection (hidden + unhidden) greys the button out** rather than guessing. "Select all" never
  includes hidden assets, so it cannot produce a mixed selection.
- Hidden assets are **excluded from every dynamic surface** — folder-filtered galleries, tag-filtered
  galleries, the collection-index listing and the project detail pages, all of which query assets by folder
  or tag. They are **not** excluded from static galleries, which name their assets explicitly.
- A mixed selection including hidden files may still create a transition group (a hidden "before" shot is the
  expected case).

## Touchpoints to change

| area | change |
|---|---|
| `prisma/schema.prisma` | `Asset.hidden`; migration + regenerate the client |
| `api/assets` (+ new `transition` route) | create/update/delete a group; hide/unhide; refuse <2 members; dissolve 2→1 |
| `api/assets/reorder`, `batch-move` | unaffected by design (groups are assets, the folder lock already covers them) |
| `admin/files/FolderPageClient` + `UploadModal`/toolbar | the button order, the disabled+tooltip state, the hidden section, the group card in the grid |
| `admin/files/AssetTile` or a shared tile | group-aware thumbnail (the shared component, used by the public grids too) |
| `lib/folders.ts` (`pickCover`, `getFolderCards`) | skip groups (never a cover) and hidden (already last, but explicit for safety) |
| `sections/Gallery.tsx` (`fetchAssets`) | `hidden: false` for dynamic galleries only; groups already pass the mime filter |
| `sections/CollectionItem.tsx` | the same filter (project detail pages are dynamic) |
| `sections/GalleryClient.tsx`, `GalleryLightbox.tsx`, `CollectionItemClient.tsx` | render the shared tile; one lightbox stop per group, dots + hover pause |
| new `sections/TransitionTile.tsx` | the animation, preload-then-cycle, in-view gate, reduced-motion, dots |
| `lib/media-refs.ts`, `reconcileMediaUsage` | a group's members are usages; the group's own `publicUrl` must not register a false one |
| `lib/revalidate.ts` + `scripts/check-media-lib.ts` | new mutation kinds (create/update/delete/hide) with their tags and paths, plus assertions |
| `lib/pages.ts` / guards | the delete-and-move warning text for a member in a group |

## Verification

- `npx tsc --noEmit`; `npx prisma generate` first (schema changed).
- A group renders in a grid slot, a hero slot and the lightbox, at the same dimensions as an image in that
  slot, with the correct candidates (`w=`/`q=` measured by resource timing).
- Load behaviour: the cycle waits for all members at the first image.
- Hide: absent from a folder-filtered gallery, a tag-filtered gallery, the collection index and the project
  detail page; still present in a static gallery and in both pickers.
- Cover: a group in first position and a hidden first image are both skipped by the folder card.
- Guards: deleting/moving a member warns with the group name; confirming a delete dissolves a 2-group and
  removes a member from a 3-group; a 1-group cannot be saved by any path.
- Lightbox: one stop per group; the dots enlarge the active member and hovering pauses.
- `scripts/check-media-lib.ts` passes with the new assertions.

## Open items (decided here, confirm or overrule)

1. **Dissolving a 2-group deletes the group row** rather than leaving it as a plain image, so the surviving
   member is not duplicated.
2. **Unhide appends to the end of the order** (no position restore).
3. **The dots live in the lightbox tile**; in the grid the tile cycles without dots (the grid tile is too
   small for them). Say the word if the grid tile should show them on hover.
4. **If every image in a folder is hidden or a group**, the folder card falls back to the neutral placeholder
   instead of picking a hidden image.
