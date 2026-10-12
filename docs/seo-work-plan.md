# SEO work plan — meeting and beating the legacy site's baseline

Companion to `docs/seo-audit-legacy-site.md` (the measurements of the old site). Everything here is
grounded in the current project's measured state, taken 2026-10-10.

## Where the new site stands today

| Item | Old site | New site today |
|---|---|---|
| Titles | 52 unique | **1 shared by all 36 URLs** (root layout only) |
| Meta descriptions | present on 8 / 52 (two of them duplicates) | **1 shared, generic** |
| Canonicals | self-referencing, all pages | **none** |
| OG / Twitter tags | all 52 URLs | **none** |
| Structured data | Organization, WebSite, Breadcrumb, ImageObject | **none** |
| Sitemap | Yoast, 3 children, some stale | **DB-driven, 36 URLs — good** |
| robots.txt | fine | **good** (`/admin`, `/api`, `/preview` disallowed) |
| Analytics | GTM | **none** |
| Redirects | — | **none configured** |
| Page weight | 231–277 KB HTML, 134–143 KB inline CSS, 24 scripts | thin by construction (Next + RSC) |

So the new site currently **loses** on titles, descriptions, canonicals, OG and schema, and
**wins** on sitemap mechanics and delivery weight.

## Part A — meet the baseline

### A1. Per-route titles and descriptions (the biggest gap)

Nothing in the app calls `generateMetadata`; every route inherits the layout's single title. Needs:

- **`/[slug]` pages** — title from the page's label; description from a new optional
  `Page.metaDescription` field in the editor, falling back to the hero subheading.
- **`/projects`** and **`/projects/<folder>`** — title from the folder name; description from
  `Folder.description` (already in the DB and already rendered on the page — zero authoring cost).
- **Fixed routes** (`/contact`, service pages) — the same pattern.
- A **title template** in the root layout so each page supplies only its own part.

### A2. Canonicals, OG, Twitter

- `metadataBase` from `NEXT_PUBLIC_BASE_URL` (already defined and used by the sitemap).
- Self-referencing `alternates.canonical` per route.
- `openGraph` + `twitter` per route, with the page's hero image or the project's cover as
  `og:image` (the old site shipped one site-wide image; per-page is strictly better).

### A3. The 301 redirect map (required before the domain cutover)

52 old URLs exist; the new slugs often differ. A wrong or missing redirect throws away every
ranking the old pages accumulated. From the audit:

| Old | New |
|---|---|
| `/` | `/` |
| `/residential-landscaping-installation/` | `/landscape-design-installation` |
| `/residential-landscaping-maintenance/` | `/landscape-maintenance` |
| `/about-level-ground-landscape/` | `/about` |
| `/contact/` | `/contact` |
| `/project-gallery/` | `/projects` |
| `/projects/<old-slug>/` (25) | `/projects/<new-folder-slug>` — pairs live in `docs/folder-mapping-descriptions.csv` |
| `/residential_landscaping_install/<term>/` (21) | the closest service page, e.g. `concrete_slabs` → `/landscape-design-installation` |

Mechanics: a `redirects()` array in `next.config.ts`, generated from the two CSVs, plus rules that
strip trailing slashes (old URLs end in `/`, new routes do not).

### A4. Analytics

Add the GTM container (the old site tracked with GTM; the new site has none). Also SEO-adjacent:
Search Console verification and a sitemap submission at cutover.

### A5. Sitemap polish

Already DB-driven and correct — add `lastModified` per entry from the row's `updatedAt`.

## Part B — exceed the baseline

1. **Descriptions on 100% of URLs** — the old site managed 16%, and two of those were duplicates.
   With A1 in place this is authoring work, not engineering: the services/covers copy project
   already in flight is the right vehicle.
2. **`LocalBusiness` (LandscapingBusiness) JSON-LD** — the single highest-value addition, and one
   the old site never had: name, telephone, `areaServed` (Vancouver + the Lower Mainland
   neighbourhoods they name in copy), `sameAs` (Instagram + Google Business Profile if it exists),
   optionally `geo`/`openingHours`.
3. **Per-service `Service` schema** on the 12 service pages, and `ImageObject`/`CreativeWork` on
   project pages — express the cover/service vocabulary that the old site only ever had as thin
   archives.
4. **Per-page OG images** so shared links render the actual project photo.
5. **Keep the delivery win** — re-measure at cutover; the old site's 134 KB of inline CSS and 24
   scripts are the numbers to beat, and the new stack beats them by construction.
6. **Internal linking**: the project pages' cover chips are plain text today. Making each link to
   its service page turns 30+ pages into a link graph pointing at the money pages.
7. **Cutover hygiene the old site got wrong**: `www` → apex in one hop, HSTS, and
   `NEXT_PUBLIC_BASE_URL` flipped from the Vercel preview domain to the real one.

## Open decisions (operator)

1. Title suffix: keep the old site's exact `| Level Ground Landscape`, or standardise on
   "Landscaping"?
2. `/project-gallery/` → `/projects` (recommended) or the projects page's gallery section?
3. The 21 CPT archives: 301 each to its closest service page (recommended, keeps topical
   relevance) or all to `/projects`?
4. Publish a street address for `LocalBusiness`, or service-area-only (`areaServed`)?
5. Should the project pages' cover chips become links to the service pages?
6. GTM container ID to install.
