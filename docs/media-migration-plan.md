# Media format migration — LGL Full → LGL JPG

Status: **plan, nothing executed.** Measured 2026-09-28. Account/handoff side lives in `docs/handoff.md`;
this is the content-format workstream.

## Why

- Masters are 16–38 MB PNGs. 225 of 258 stored assets are PNG; 4.19 GB total = 41.9% of R2's free tier.
- `next/image` aborts its source fetch after **7 seconds** (`AbortSignal.timeout(7000)`,
  `next/dist/server/image-optimizer.js`). A page requesting several masters at once splits bandwidth, the
  big ones exceed 7 s and the optimizer answers 500 — the "some images don't load" symptom. Reproduced:
  8 parallel requests all 500 at 7.03–7.08 s, a single request 200s, and R2 itself served 206s in 0.16 s
  under the same burst.
- PNG is lossless, so a photo gains nothing: ~10× the bytes of a JPEG of the same visual result.

## Goal

Masters as JPEG at q95, original dimensions, sRGB, EXIF rotation applied — while the library keeps its
identity: the same asset ids, the same folder slugs, and every page reference still resolving.

## Decisions (confirmed 2026-09-28)

1. **Update rows in place + sweep page JSON.** No delete-and-reupload: asset ids back static galleries and
   literal URLs back every other media field, and a fresh upload changes the key (hence the URL) because keys
   carry a timestamp. Re-picking by hand is not acceptable.
2. **Reuse existing folders.** A second folder for an existing project would change its public slug
   (`/projects/<slug>`) and orphan its order/hidden/tags.
3. **Delete duplicate rows** and their objects after verification.
4. **Convert PNGs only**, on disk with ImageMagick, masters at q95. Existing JPGs are re-encoded only if
   they fail verification (no gratuitous generation loss).
5. **Keep old objects** until the sweep reports zero references to them, then delete.

## Targets

- Source: `/mnt/Big_D/LGL Project Media/` (306 → 262 files after the duplicate set was removed, 4.1 GB)
- Output: `/mnt/Big_D/LGL JPG/` — same subfolder names, `.jpg` in place of `.png`
- Conversion: `magick in.png -auto-orient -colorspace sRGB -strip -quality 95 -interlace Plane out.jpg`
  (`-auto-orient` matters: phone shots carry EXIF rotation, and stripping without applying it rotates images.)
- Verify: per-file dimensions unchanged, no same-stem collisions (`X.png` + `X.jpg` → both `X.jpg`), count in
  == count out.

## Folder mapping (local dir → DB folder)

| local dir | DB name | slug | files / rows |
|---|---|---|---|
| AlderSt | Alder St | alder-st | 7 / 7 |
| Bayswater | Bayswater St | bayswater-st | 4 / 4 |
| CartierSt | Cartier St | cartier-st | 8 / 8 |
| CypressSt | Cypress St | cypress-st | 5 / 5 |
| DukeSt | Duke St | duke-st | 6 / 6 |
| Dunbar-patio | Dunbar St - Patio | dunbar-st---patio | 3 / 3 |
| DunbarSt-Kits | Dunbar St - Backyard | dunbar-st---backyard | 7 / 7 |
| East12 | East 12th | east-12th | 6 / 6 |
| East22 | East 22nd | east-22nd | 7 / 7 |
| E.Broadway-condo | East Broadway - Condo | east-broadway---condo | 7 / 7 |
| ElliotSt | Elliot St | elliot-st | 8 / 8 |
| ElmhurstDr | Elmhurst Dr | elmhurst-dr | 6 / 6 |
| ElmSt | Elm St | elm-st | 18 / 18 |
| LarchSt | Larch St | larch-st | 12 / 11 |
| SouthSurrey | South Surrey | south-surrey | 5 / 5 |
| West10-frontgarden | West 10th | west-10th | 7 / 7 |
| West11 | West 11th | west-11th | 9 / 9 |
| West11-patio | West 11th - Patio | west-11th---patio | 5 / 5 |
| West14 | West 14th | west-14th | 9 / 9 |
| West15 | West 15th | west-15th | 10 / 10 |
| West24 | West 24th | west-24th | 5 / 10 (dupes) |
| West29 | West 29th | west-29th | 6 / 6 |
| West31 | West 31st | west-31st | 14 / 14 |
| West32 | West 32nd | west-32nd | 8 / 8 |
| West35 | West 35th | west-35th | 13 / 13 |
| West35-curb | West 35 - Curb | west-35---curb | 5 / 5 |
| West6 | West 6th | west-6th | 10 / 10 |
| West9 | West 9th | west-9th | 8 / 8 |
| WestVan | West Vancouver | west-vancouver | 27 / 27 |
| WiltshireSt | Wiltshire St | wiltshire-st | 7 / 7 |

- **DunbarSt-Kits → Dunbar St - Backyard** is confirmed, not assumed: every file inside the DB folder is
  named `DunbarSt-Kits_*`.
- `LarchSt_00001_s.png` exists only on disk — never uploaded. It gets uploaded by this migration.
- `Logo/` (8 files, 29 KB) and `Assets/` (2 placeholder files) are not library media. The DB's hidden
  `Assets` folder (slug `test`) holds the rain-barrel placeholder, which has no counterpart in the tree —
  left alone unless told otherwise.
- `Videos` (the mp4 + its derived 720p + poster) is untouched.
- Local dir names do **not** need renaming for the migration (it matches by table, then by folder slug +
  filename). Renaming them to the DB names is still worthwhile *afterwards* so the folder-aware uploader
  derives correct folder names for future uploads.

## Pipeline

Each step is idempotent and resumable — matching is on (folder slug, filename), so a re-run skips finished
work:

1. **Convert** PNGs into `LGL JPG/`; verify counts and dimensions.
2. **Dry-run report** (no writes): per folder — local files, DB rows, local files with no row, rows with no
   local file, duplicate rows. Sign-off before anything is written.
3. **Upload** each converted JPEG to a fresh key `media/<slug>/<ts>-<name>` (direct S3 PUT with the scoped R2
   token; fresh keys also mean no stale optimizer or CDN cache).
4. **Update the matched Asset row in place**: `storageKey`, `publicUrl`, `size`, `mime`, `width`, `height`.
   The id, folder, orderIndex, alt text and usage rows are untouched.
5. **Sweep page JSON**: old URL → new URL across every section field, `entityImages`, covers — handling both
   raw-space and `%20` spellings, the same way `media-refs.ts` resolves references.
6. **Verify**: the reference scan reports zero old-key references; the optimizer answers 200 at several widths
   for a sample from each folder; folder page counts match.
7. **Delete the old R2 objects** (rows stay).
8. **Delete duplicate rows** and their objects.
9. Re-run `npx tsx scripts/storage-usage.ts` and update the Capacity line in `docs/handoff.md`.

## Not in scope

- **Per-component image quality** (q95 full-span, q85 one-third-width, q75 thumbnails). Later, with the layout
  pass that narrows margins and enlarges images. That work needs the allowed qualities declared in
  `next.config.ts` (`images.qualities`) plus a re-measure of every `sizes` string afterwards — using the
  browser's resource-timing entries, since `naturalWidth` lies for `srcset` images.
- Video re-encoding — the mp4 pipeline already produces 720p + poster.
