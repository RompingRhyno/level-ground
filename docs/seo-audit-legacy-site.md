# SEO audit — the legacy site (`levelgroundlandscape.com`)

Measured 2026-10-10 against the live site. Method is reproducible: raw `curl` of the rendered HTML
and the Yoast sitemaps, plus the WordPress REST API
(`/wp-json/wp/v2/<type>?per_page=100&_fields=link,title,modified,yoast_head_json`), which returns the
exact SEO head Yoast would render.

## What the site is

| Layer | Implementation |
|---|---|
| CMS | WordPress |
| Page builder | Elementor + Elementor Pro (every layout) |
| Theme | Twenty Twenty-Three (stock; the builder does the work) |
| SEO | Yoast SEO (titles, meta, canonicals, OG/Twitter, schema graph, sitemaps) |
| Caching | WP Rocket (CSS inlined, some lazy-loading) |
| Analytics | Google Tag Manager + Site Kit by Google |
| Spam | CleanTalk |

## Inventory

| Source | Count |
|---|---|
| REST: pages | 6 |
| REST: `projects` (CPT) | 25 |
| REST: `residential_landscaping_install` (CPT) | 21 |
| **REST total indexable URLs** | **52** |
| Sitemap: pages | 6 |
| Sitemap: projects | 26 (25 + the archive root) |
| Sitemap: `residential_landscaping_install` | **6 — but 21 exist** |

## Implemented well

1. **Yoast is actually configured.** All 52 URLs carry a non-empty title; none are duplicates;
   only 3 exceed 60 characters. Titles follow `<Page> | Level Ground Landscape` consistently.
2. **Self-referencing canonicals** on every URL examined (home, about) — no cross-page canonical
   mistakes.
3. **OG + Twitter on all 52 URLs** (card type and `og:image` present site-wide).
4. **Structured data via Yoast's graph:** `Organization` (name, url, logo, `sameAs`), `WebSite` +
   `SearchAction`, `BreadcrumbList`, `ImageObject`, `WebPage`, and `CollectionPage` on archives.
5. **One `h1` per page**, including on Elementor-built pages (a common failure mode).
6. **Alt text is nearly complete** (2 of 38 images on the homepage lack it).
7. **Redirect hygiene, mostly:** `http://` → 301 → `https://`; `/contact` → 301 → `/contact/`;
   a real 404 on unknown paths. The one flaw: `https://www.` → 301 → `http://` (apex) → 301 →
   `https://` — a two-hop chain.
8. **Sitemaps + robots.txt** are correct in shape (Yoast index with three children, declared in
   robots; only `AdsBot` disallowed).
9. **Descriptive URL slugs** throughout (`/residential-landscaping-installation/`,
   `/about-level-ground-landscape/`).

## Gaps, ranked by impact

### 1. Meta descriptions are missing on 44 of 52 URLs (84%)

| Page | Description |
|---|---|
| Home | present (175 chars — slightly long, truncates ~155) |
| Residential maintenance | present (141) |
| About | **boilerplate**: `Level Ground Landscape Vancouver, BC. 778-223-5005 info@…` |
| Contact | **the same boilerplate** (duplicated) |
| Installation, Project gallery | **none** |
| Projects (25) | **none except two** (Cartier, East 12th) |

The two pages that do have "descriptions" are duplicates of each other, so the effective site-wide
count is six unique descriptions for 52 URLs. Google writes its own snippets for the rest, from
whatever text it finds first.

### 2. No local-business schema

The `Organization` node carries name, url, logo and one `sameAs` (Instagram). It has **no address,
no telephone, no geo, no `areaServed`, no opening hours** — and the business's actual NAP
(`778-223-5005`, email, Vancouver BC) exists only inside a meta description string. For a
residential landscaping business whose traffic is "landscaping <city/neighbourhood>", a
`LocalBusiness`/`LandscapingBusiness` node with the NAP and `areaServed` is the single highest-value
structured-data addition.

### 3. Twenty-one indexable ghost pages

`/residential_landscaping_install/<term>/` — one per old service/material term (aggregate_slabs,
artificial_grass, boulevard, concrete_slabs, decking, driveway, excavation, fencing, gravel, hedges,
new_lawn, planting, topsoil, trees, …).

Measured example — `/residential_landscaping_install/aggregate_slabs/`:

- 151 KB of HTML, **48 words of text**
- **0 links to the projects** it is supposedly an archive of
- indexable (`index, follow`), in the REST inventory, h1 present, "Aggregate slabs Archives" title

So: thin, indexable dead ends, each competing with the page it should support. Worse, only 6 of the
21 appear in the sitemap, so 15 are orphaned from Yoast's own map while still being crawled.

### 4. Page weight driven by inlining

| Metric | Home | About |
|---|---|---|
| HTML size | 277 KB | 231 KB |
| Inline `<style>` blocks | 11 | 10 |
| Inline CSS bytes | **134 KB** | **143 KB** |
| External stylesheets | 0 | 0 |
| External scripts | 24 | 24 |
| Images | 38 (2 no-alt, 15 lazy) | 5 (2 no-alt, 0 lazy) |

WP Rocket has inlined everything, so there are no render-blocking stylesheet requests — in exchange
every page ships 130–140 KB of CSS inside its HTML, which is re-downloaded on every navigation (no
shared cacheable stylesheet). Elementor's script count (24) is unchanged by it.

### 5. Sitemap freshness and completeness

Last-modified stamps: pages 2021-10 → 2025-02; projects 2021-09 → 2024-03; the
`residential_landscaping_install` sitemap is frozen at **2022-02-22** for all entries — and covers
only 6 of the 21 live URLs.

## What this means for the rebuild

1. **Keep the strong signals.** Titles (page + project level), canonicals, OG/Twitter, breadcrumbs.
   The new site's `generateMetadata` needs an equivalent for all 52 old URLs.
2. **Fix the 84% gap while migrating.** The new CMS's copy project (services + covers) is the
   opportunity: each service page and each project page should ship a real 150–160-char description.
   The old site never had them; the new one can, cheaply, at authoring time.
3. **Add `LocalBusiness` schema** with the NAP + `areaServed` (Vancouver, Lower Mainland). The new
   stack can serve it statically; the old one only ever had the generic `Organization` node.
4. **Redirect map is mandatory** — 52 indexable URLs, including 21 archive URLs whose concept
   (the old service/material vocabulary) now lives as 32 cover tags under 12 services. Decide per
   archive: 301 to the closest new service page, or 301 to `/projects` filtered, never a 404.
   Note the trailing-slash convention difference: old URLs end in `/`, the new routes do not.
5. **Consolidate the ghost archives' value** rather than recreating them: the new `/projects`
   service filters express the same "show me work by material/service" intent on one strong URL.
6. **Consider the www → apex chain:** the new hosting should redirect `www` straight to the apex
   in one hop.
