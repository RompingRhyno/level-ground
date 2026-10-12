# Services revamp — plan

Status: structure agreed with the operator 2026-10-04; tags not yet applied to any project.
Source data: `docs/services-audit.md` (the scrape and the reasoning) and `docs/services-audit.csv`
(one row per raw mention, with `kind` / `canonical_service` / `category` / `material_detail`).

The scraped baseline: **25 projects, 120 service mentions, 55 unique strings.** Every raw string is
accounted for below — 90 across the ten installation services, 23 in the processes section, 3 in the
design reference and 1 preserved (water feature), plus 3 on the maintenance side.

Model, in the operator's words: **outcomes only.** A service is a thing the client gets. Processes are
excluded and addressed by an informational section; materials are detail under an outcome, never a
service of their own.

---

## 1. Installation page

| # | section | type | mentions | copy |
|---|---|---|---|---|
| 1 | Design | info | 3 | new |
| 2 | Pavers & Patios | service | 27 | exists |
| 3 | Planting | service | 19 | new |
| 4 | Lawn installation | service | 15 | partly — Micro clover and Artificial turf keep their copy as sub-headings |
| 5 | Garden beds & boxes | service | 10 | new |
| 6 | Retaining walls | service | 5 | exists |
| 7 | Rock & gravel features | service | 4 | new |
| 8 | Decking | service | 3 | new |
| 9 | Fencing | service | 3 | exists |
| 10 | Outdoor Lighting | service | 3 | exists ("Outdoor garden lights") |
| 11 | Irrigation | service | 1 | exists but misfiled — currently under the Lighting heading |
| 12 | Processes | info | 23 | new |

Order runs heaviest-first apart from Design opening the page and Processes closing it. Reordering is
free; the weights are what the data supports.

## 2. Maintenance page

| # | section | type | copy |
|---|---|---|---|
| 1 | Lawn maintenance | service | exists ("Lawn Care") |
| 2 | Garden maintenance — cultivation and weeding, pruning, hedging, leaf and debris clearing, bed renovation, tree pruning, **seasonal planting** | service | exists ("Garden Maintenance") |
| 3 | Processes (optional cross-post, rephrased for maintenance) | info | new |

**Do not cross-post Planting.** Installation sells planting (done once); maintenance sells seasonal
planting (repeated), now folded into Garden maintenance. Naming the variant *seasonal* everywhere is
what keeps the two pages from competing for the same query, exactly as with **hedge planting**
(installation) versus **hedge trimming** (maintenance).

The processes cross-post is a capability statement, not history: every project in the scraped dataset is
an installation, so nothing in the data evidences excavation on a maintenance job.

---

## 3. Consolidated covers

The cleaned detail under each service. "Absorbs" lists the raw strings each detail replaces, so the 55
strings collapse into the sets below with no two details meaning the same thing.

### Pavers & Patios — 27

| detail | mentions | absorbs |
|---|---|---|
| Patio | 11 | Patio, Interlocking patio, Cedar patio |
| Walkway | 2 | Walkway, Paved walkway |
| Driveway | 1 | Driveway |
| material: interlocking brick | 3 | Interlocking bricks |
| material: concrete slab | 6 | Concrete slabs |
| material: natural stone (granite) | 2 | Granite pavers, Granite blocks |
| material: paving stone | 2 | Pavers, Paving stone installation |

`Cedar patio` stays here, not under Decking — the operator's rule is that **decking is raised and a
patio is ground level**, and West 6th's cedar surface is ground level.

### Planting — 19

| detail | mentions | absorbs |
|---|---|---|
| Trees | 4 | Tree install, Palm trees, Banana trees |
| Shrubs, perennials & ground cover | 10 | Plants, Ground cover planting, Sedum stonecrop |
| Hedges | 3 | Hedges |
| material: mulch | 2 | Mulch |

`Plants` is the generic form and lands in the middle row; species names (palm, banana, sedum) are examples
for the copy, not separate details.

### Lawn installation — 15

| detail | mentions | absorbs |
|---|---|---|
| Sod lawn | 8 | New lawn install |
| Micro clover | 3 | Micro clover |
| Artificial turf | 3 | Artificial grass |
| Putting green | 1 | Putting green |

Putting green sits under artificial turf as a synthetic application. Its project —
`renewed-backyard-with-putting-green`, listed as *Cartier Street* — is named after it.

### Garden beds & boxes — 10

| detail | mentions | absorbs |
|---|---|---|
| Garden beds (new, raised, reshaped) | 4 | Raised garden beds, Garden bed installation, Reshape garden beds |
| Vegetable boxes | 2 | Raised vegetable garden, Vegatable box |
| Small gardens | 1 | Small garden installation |
| material: topsoil / soil amendment | 3 | Topsoil |

`Small garden installation` is a scope descriptor rather than a separate build; it is kept as a detail so
the phrase survives. Typo fixed: **Vegatable box → Vegetable box**.

### Retaining walls — 5

| detail | mentions | absorbs |
|---|---|---|
| Engineered systems | 5 | Retaining wall, Engineered retaining wall |

### Rock & gravel features — 4

| detail | mentions | absorbs |
|---|---|---|
| River rock | 2 | River rock, Decretive river rock |
| Basalt gravel | 1 | Black basalt gravel |
| Boulders | 1 | Rock boulders |

Typo fixed: **Decretive river rock → Decorative river rock**.

### Decking — 3

| detail | mentions | absorbs |
|---|---|---|
| Cedar | 1 | Cedar decking |
| Composite | 1 | Composite decking |
| Decking (generic) | 1 | Decking |

### Fencing — 3

| detail | mentions | absorbs |
|---|---|---|
| Aluminum | 1 | Aluminum fence |
| Cedar | — | no raw mention; named in the existing page copy ("pre-fab cedar fence structure") |
| Fencing (generic) | 2 | Fencing |

### Outdoor Lighting — 3

| detail | mentions | absorbs |
|---|---|---|
| Garden & landscape lighting | 3 | Lighting, Garden spotlights |

Driveway and walkway security lighting is in the existing copy and should stay in it. The irrigation
paragraph currently sitting under this heading moves to Irrigation.

### Irrigation — 1

| detail | mentions | absorbs |
|---|---|---|
| Automatic irrigation / drip line | 1 | Irrigation |

### Garden maintenance — 3 (maintenance page)

| detail | mentions | absorbs |
|---|---|---|
| Scheduled maintenance | 1 | Garden maintenance |
| Tree pruning | 1 | Tree pruning |
| Seasonal planting | 1 | Seasonal planting |

"Tree pruning here" per the operator. Lawn maintenance covers mowing, seasonal aerating, fertilization,
power raking moss control and over-seeding, all from the existing "Lawn Care" prose.

---

## 4. Informational sections

**Design** — an informational section near the top of the installation page, **not a service and not a
tag**. Its project list is preserved here for reference:

| project | as written | slug |
|---|---|---|
| West Vancouver | Landscape design | `west-vancouver-landscaping-installation` |
| Dunbar Street | Landscape design plan | `dunbar-street-patio-installation` |
| Cartier Street | Landscape design plan | `renewed-backyard-with-putting-green` |

**Processes** — informational on the installation page, covering the underlying work done as needed.
Scraped evidence, 23 mentions:

| process | mentions | absorbs |
|---|---|---|
| Site preparation & excavation | 21 | Excavation (18), Bobcat work (3) |
| Removal & clearing | 2 | Remove stump, Bamboo removal |

Worth stating on the page in these terms: Excavation is the single most-mentioned item in the whole
scraped dataset — 18 of 25 projects — so this section is what keeps the site's most common activity
visible now that it is not a service.

---

## 5. Preserved for reference, not tagged

**Water feature — dropped from the services for now.** One project, one mention: **Duke street**
(`duke-street-decking`), whose page copy explains it — *"We also installed a water fountain to drown out
some of the street noise."* A site-specific solve rather than an offering. Preserved here so it can be
reinstated without re-scraping, and nothing is lost meanwhile because Duke street's own page copy names
the fountain. If it ever returns, widen the Irrigation heading rather than adding a service — irrigation
is watering systems and a fountain is decorative water, so "Irrigation & water features" is the honest
umbrella.

## 6. Tags belong to the project (decided 2026-10-04)

**A tag is a property of the project, not of a page.** An installation project may carry maintenance tags
without issue — West 31st is genuinely a job that included seasonal planting and garden maintenance, and
suppressing that would misrepresent the work.

So the installation/maintenance split is a **property of the service**, never of the project:

* the service carries its group (`installation` or `maintenance`),
* the project carries whatever services it actually involved, from either group,
* each page lists only its own group's services, which is what keeps the two service lists clean.

The old site's schema already assumed this — both taxonomies were attached to the same `projects` post type,
so a project could carry both. Worth being precise about the precedent though: it was never exercised. Only
**one** project was ever tagged (Elliott Street, 6 install terms) and **no** project carried both
vocabularies, so this is a design intent rather than something the old data proves.

**Two layers, and they are not the same thing (corrected 2026-10-05).** Earlier this was written as a
grouping of services; the operator's intent is sharper:

- **Tags are the specific covers** — the consolidated, deduplicated items in `docs/services-revamp-tags.csv`
  (`detail` column): Patio, Hedges, Micro clover, River rock, Tree pruning and so on. A project earns the
  ones it actually involved. **The live vocabulary is the `COVERS` table in
  `scripts/apply-cover-tags.ts`; the current list and the evidence behind every cover are in
  `docs/service-copy-brief.md`.** The audit documents (`services-audit.*`) are a historical record of the
  first pass and use earlier names — do not read vocabulary from them.
- **Services are the categories above them** — Pavers & Patios, Planting, Lawn installation, Garden beds &
  boxes, Retaining walls, Rock & gravel features, Decking, Fencing, Outdoor Lighting, Irrigation, plus
  Garden maintenance on the maintenance side. A service is not a tag; it is what a tag sits under.

`Tag.service` (a service slug) is the wiring between the two. A services page or the gallery picker gathers
its covers by querying the tags whose `service` matches, then resolves those through the folders carrying
them — `getFirstAssetUrlsByTagSlugs()` in `src/lib/tags.ts` already does that resolution per tag, so the
data is the only piece that had to exist. Material rows in the CSV carry a `material: ` prefix that the
applier strips before matching.

Applied by `npx tsx scripts/apply-cover-tags.ts` (dry run by default): it creates the 33 cover tags with
their service, assigns each folder the covers it earned, and removes the service-level tags the earlier
pass created — nothing else referenced them. Landscape design, the processes and the water feature stay
tagless by design, and Lawn maintenance has no covers yet.

## 7. Sequence

1. Lock the ten installation names and the two maintenance names.
2. Re-tag all 25 projects with outcome services only; material becomes detail on the card, and the two
   typos are fixed at the same time.
3. Rebuild the taxonomy on those names, with the six categories as a parent level.
4. Restructure the installation page: split Irrigation out from Outdoor Lighting, add the Design and
   Processes sections, reorder heaviest-first.
5. Restructure the maintenance page: the two existing headings become services, seasonal planting folds
   into Garden maintenance, processes optionally cross-posted and rephrased.
