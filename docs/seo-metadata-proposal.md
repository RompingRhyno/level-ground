# SEO metadata proposal — titles, descriptions, archive mapping

> **Status (2026-10-12): metadata layer implemented and verified.**
> Built: `src/lib/seo.ts` (title/description/canonical/OG helpers + the confirmed NAP), `Page.metaTitle`/`Page.metaDescription` (migration `page_seo_fields`, seeded for the six pages, editable in the page editor), `generateMetadata` on `/`, `/[slug]` and `/[slug]/[entitySlug]` (project titles = name-only, descriptions fall back to hero subheadings / folder copy / covers), canonicals, OG/Twitter, one JSON-LD graph (Organization + LocalBusiness + WebSite) in `(site)/layout.tsx`, and `lastModified` in `sitemap.ts`.
> Found and fixed in passing: `NEXT_PUBLIC_BASE_URL` is stored without a scheme, so the **live sitemap and robots.txt were emitting scheme-less URLs** (`level-ground-seven.vercel.app/...`), which crawlers reject; `sitemap.ts`/`robots.ts`/`lib/seo.ts` now share one normalized origin.
> Not yet built: the 301 redirect map, `Service` schema on the 12 service pages, `CreativeWork` on projects, per-page OG image overrides.

For audit before implementation. Companion to `docs/seo-audit-legacy-site.md` (old site) and
`docs/seo-work-plan.md` (the gap list). All sources are fields that already exist; the "authoring"
column marks where new writing is genuinely needed.

## 1. Titles

**Suffix decision (locked):** `| Level Ground Landscape` — the actual business name; matches the
old site verbatim.

**Page-title seeding (audit this list).** These six are the old site\'s titles, verbatim, to be
seeded into the new optional `metaTitle` field; the page label remains the fallback for new pages.

| New route | Seeded title |
|---|---|
| `/` | Residential Landscaping \| Level Ground Landscape Vancouver, BC |
| `/about` | About \| Level Ground Landscape |
| `/contact` | Contact \| Level Ground Landscape |
| `/projects` | Residential Landscaping Projects \| Level Ground Landscape |
| `/landscape-design-installation` | Residential Landscaping Installation \| Level Ground Landscape |
| `/landscape-maintenance` | Residential Landscaping Maintenance \| Level Ground Landscape |

**Project titles — pattern chosen: `<Folder name>: <service> | Level Ground Landscape`.** Two ways
to pick the `<service>`, measured against the live data (30 visible folders):

| Rule | Distribution |
|---|---|
| **A — literal**: the most popular service (by project count) among the project\'s services | Pavers & Patios on **23 of 29** — near-duplicate titles |
| **B — recommended**: the project\'s *own* most-used service, ties broken by global rank | Pavers & Patios 16 · Planting 8 · Lawn installation 4 · Garden maintenance 1 |

Since every project that contains any paver work is "Pavers & Patios" under rule A, the descriptive
end collapses; B keeps the service vocabulary while differentiating. Examples:
`Cypress St: Pavers & Patios | …`, `Cartier St: Lawn installation | …`, `West 14th: Lawn installation | …`.

**Length guard (locked): append the runner-up only when the full title stays ≤ 65 chars.** Without it,
10 of 29 titles exceeded 60 characters (worst: 83) and the brand suffix — which sits at the end — is
what Google cuts. At 65: 4 titles sit at 62–64, the max is 64, and 5 titles keep their runner-up
(Cypress St, Larch St, West 32nd, West 6th, Wiltshire St). Final list (site order by name):

```
Alder St: Planting | Level Ground Landscape                        Bayswater St: Pavers & Patios | Level Ground Landscape
Cartier St: Lawn installation | Level Ground Landscape             Cypress St: Pavers & Patios, Planting | Level Ground Landscape
Duke St: Planting | Level Ground Landscape                         Dunbar St - Backyard: Pavers & Patios | Level Ground Landscape
Dunbar St - Patio: Pavers & Patios | Level Ground Landscape        East 12th: Pavers & Patios | Level Ground Landscape
East 22nd: Lawn installation | Level Ground Landscape              East Broadway - Condo: Planting | Level Ground Landscape
Elliott St: Planting | Level Ground Landscape                      Elm St | Level Ground Landscape   (no covers yet)
Elmhurst Dr: Lawn installation | Level Ground Landscape            Larch St: Pavers & Patios, Planting | Level Ground Landscape
South Surrey: Pavers & Patios | Level Ground Landscape             West 10th: Planting | Level Ground Landscape
West 11th: Planting | Level Ground Landscape                       West 11th - Patio: Pavers & Patios | Level Ground Landscape
West 14th: Lawn installation | Level Ground Landscape              West 15th: Planting | Level Ground Landscape
West 24th: Pavers & Patios | Level Ground Landscape                West 29th: Pavers & Patios | Level Ground Landscape
West 31st: Garden maintenance | Level Ground Landscape             West 32nd: Pavers & Patios, Planting | Level Ground Landscape
West 35th: Pavers & Patios | Level Ground Landscape                West 35th - Curb: Planting | Level Ground Landscape
West 6th: Pavers & Patios, Planting | Level Ground Landscape       West 9th: Pavers & Patios | Level Ground Landscape
West Vancouver: Pavers & Patios | Level Ground Landscape           Wiltshire St: Pavers & Patios, Planting | Level Ground Landscape
```

## LocalBusiness NAP (confirmed by the operator)

```
name:    Level Ground Landscape
street:  2768 W Broadway
city:    Vancouver, BC V6K 4P4
phone:   (778) 223-5005
email:   info@levelgroundlandscape.com
areaServed: Vancouver and the Lower Mainland
```

Address is published in the Google listing already, so it goes in the schema (decision 6).

(Service popularity ranking, projects per service: Pavers & Patios 23 · Planting 16 ·
Lawn installation 14 · Garden beds & boxes 9 · Rock & gravel 6 · Retaining walls 5 · Fencing 4 ·
Outdoor Lighting 4 · Decking 3 · Irrigation 2 · Garden maintenance 2 · Lawn maintenance 0.)

| Route | Proposed title | Source | Status |
|---|---|---|---|
| `/` | Residential Landscaping \| \<suffix\> Vancouver, BC | old site's home title, verbatim pattern | ready |
| `/about` | About \| \<suffix\> | old title + `Page.label` | ready |
| `/contact` | Contact \| \<suffix\> | old title + `Page.label` | ready |
| `/projects` | Residential Landscaping Projects \| \<suffix\> | old gallery title | ready |
| `/landscape-design-installation` | Residential Landscaping Installation \| \<suffix\> | old title, verbatim | ready |
| `/landscape-maintenance` | Residential Landscaping Maintenance \| \<suffix\> | old title, verbatim | ready |
| `/projects/<folder>` | `<Folder name>: <cover 1> & <cover 2> \| <suffix>` | `Folder.name` + its cover tags | ready — no authoring |

Notes:

- The four page labels today are short nav words ("Installation", "Maintenance") — fine as
  fallbacks, but the page routes need the old site's fuller wording. Either a static map or a new
  optional `Page.metaTitle` field in the editor.
- Project titles: the old site mixed minimal ("Cartier Street - …") and descriptive ("West 26th
  patio installation - …"). The proposed pattern takes the descriptive end, using covers that are
  already tagged — e.g. **"Cypress St: Concrete slabs & Sod lawn | Level Ground …"**.

## 2. Meta descriptions

Fallback chain: new optional `Page.metaDescription` → the hero subheading → a composed line.

| Route | Source | Status |
|---|---|---|
| `/` | old site's own description (175 chars — trim to ~155) | ready |
| `/about` | hero subheading (identical to the old site's meta description) | ready |
| `/landscape-design-installation` | hero subheading | ready |
| `/landscape-maintenance` | hero subheading | ready |
| `/projects` | — | authoring (one line) |
| `/contact` | — (old site used NAP boilerplate; write a real one) | authoring (one line) |
| `/projects/<folder>` | `Folder.description` when present; else compose from covers | mostly authoring — 4 of 32 folders have a description |

The project folder descriptions are the real authoring block: 28 of 32 are empty. The old project
pages had copy, and `docs/service-copy-brief.md` already catalogues it — the same pass that writes
service/cover copy can fill these.

## 3. Titles/meta mechanics

- Root layout gets `metadataBase` (from `NEXT_PUBLIC_BASE_URL`) and a title template.
- Each route exports `generateMetadata` reading its own fields.
- Canonicals: `alternates.canonical` per route. The concrete need is the filtered index URLs
  (`/projects?service=…`, `/projects?tag=…`) — without a canonical those read as separate pages
  with near-duplicate content, and the old site shipped self-referencing canonicals on every URL.

## 4. The 21 legacy archive URLs → service sections

All 21 map to a cover under one of the 12 services; the destination is that service's section on
the installation or maintenance page (`/landscape-design-installation#<service>`, `/landscape-maintenance#<service>`).

| Old archive | Service section |
|---|---|
| aggregate_slabs | pavers-and-patios |
| artificial_grass | lawn-installation |
| **boulevard** | **ambiguous** — planting? |
| concrete_slabs | pavers-and-patios |
| decking | decking |
| driveway | pavers-and-patios |
| **excavation** | **ambiguous** — process, no service; the installation page top? |
| fencing | fencing |
| gravel | rock-and-gravel-features |
| hedges | planting |
| lighting | outdoor-lighting |
| micro_clover | lawn-installation |
| new_lawn | lawn-installation |
| patio | pavers-and-patios |
| planting | planting |
| retaining_wall | retaining-walls |
| topsoil | planting |
| trees | planting |
| vegetable_box | garden-beds-and-boxes |
| walkway | pavers-and-patios |
| **water_feature** | **ambiguous** — no cover exists; rock-and-gravel-features? |

18 of 21 are unambiguous; 3 need your call.

## 5. Structured data (baseline + above)

Baseline (the old site's Yoast graph, currently absent here): `Organization`, `WebSite` +
`SearchAction`, `BreadcrumbList`, `ImageObject`. One JSON-LD block in the layout covers the first
two globally; breadcrumbs per route.

Above baseline: `LocalBusiness` (NAP pending your verification against the business details,
`areaServed` = Vancouver/Lower Mainland), `Service` on the 12 service pages, `CreativeWork`/
`ImageObject` on project pages.
