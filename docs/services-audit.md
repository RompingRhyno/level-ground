# Service vocabulary audit — levelgroundlandscape.com

Scraped 2026-10-04 from the project gallery plus the WordPress REST API. The service text on each project
card is an Elementor text-editor widget, not a taxonomy: the post type's two taxonomies
(`residential_landscaping_install`, `residential_landscaping_maint`) are effectively unused — 1 of 25
projects carries any install term, 0 carry a maintenance term — so that 21-term list is an abandoned draft.

**Totals:** 25 projects · 120 service mentions · 55 unique strings · 36 used only once.

**Model: outcomes only.** A mention is classified as one of four kinds — `outcome` (a thing the client
gets, and therefore a service), `material` (a detail of an outcome, not a service of its own), `process`
(underlying work that is done as needed and belongs on the services page as reassurance, not as a listed
service), or `maintenance` (a different vocabulary, kept separate from installation).

| kind | mentions | treatment |
|---|---|---|
| outcome | 69 | **17 canonical services** |
| material | 25 | folded under its outcome as detail |
| process | 23 | excluded — goes to the processes section |
| maintenance | 3 | excluded — maintenance vocabulary |

## 1. The outcome services

| category | service | mentions | absorbs as material detail |
|---|---|---|---|
| Lawn | **Lawn installation** | 8 | — |
| Lawn | **Micro clover lawn** | 3 | — |
| Lawn | **Artificial lawn** | 3 | — |
| Softscape | **Planting** | 10 | Mulch |
| Softscape | **Garden beds & vegetable boxes** | 7 | Topsoil |
| Softscape | **Trees & shrubs** | 4 | — |
| Softscape | **Hedges** | 3 | — |
| Hardscape | **Patio & paving** | 11 | Cedar patio, Concrete slabs, Granite blocks, Granite pavers, Interlocking bricks, Pavers |
| Hardscape | **Retaining walls** | 5 | — |
| Hardscape | **Walkways & driveways** | 3 | — |
| Structures | **Fencing** | 2 | Aluminum fence |
| Structures | **Decking** | 1 | Cedar decking, Composite decking |
| Structures | **Water feature** | 1 | — |
| Structures | **Putting green** | 1 | — |
| Systems | **Lighting** | 3 | — |
| Systems | **Irrigation** | 1 | — |
| Design | **Landscape design** | 3 | — |

## 2. Processes — excluded from services

Named in the project data but not outcomes. These are the ones the installation page's new
"processes done as needed" section would cover:

**from the project data:**
* Bamboo removal  _(Removal & clearing)_
* Bobcat work  _(Site & groundwork)_
* Excavation  _(Site & groundwork)_
* Remove stump  _(Removal & clearing)_

**maintenance-side, listed for completeness:**
* Garden maintenance  _(Maintenance)_
* Seasonal planting  _(Maintenance)_
* Tree pruning  _(Maintenance)_

Note `Excavation` is the single most-mentioned string in the whole dataset (18 of 25 projects). Pulling it
out of the service list is a real decision — it is the strongest case for the processes section carrying
weight on the page, because it is what most projects actually involved.

## 3. Materials — all folded under an outcome

| material as written | sits under |
|---|---|
| Aluminum fence | Fencing |
| Black basalt gravel | Gravel & rock features |
| Cedar decking | Decking |
| Cedar patio | Patio & paving |
| Composite decking | Decking |
| Concrete slabs | Patio & paving |
| Decretive river rock | Gravel & rock features |
| Granite blocks | Patio & paving |
| Granite pavers | Patio & paving |
| Interlocking bricks | Patio & paving |
| Mulch | Planting |
| Pavers | Patio & paving |
| River rock | Gravel & rock features |
| Rock boulders | Gravel & rock features |
| Topsoil | Garden beds & vegetable boxes |

## 4. Every project and its services (verbatim)

| project | services as written |
|---|---|
| Alder street | Tree install, Plants, Artificial grass, Excavation, Concrete slabs, Remove stump, Composite decking, Raised vegetable garden |
| Bayswater | Excavation, Interlocking bricks |
| Cartier Street | New lawn install, Excavation, Landscape design plan, Garden bed installation, Putting green, Paved walkway, Palm trees, Banana trees, Garden spotlights |
| Cypress street | New lawn install, Excavation, Concrete slabs, Bobcat work |
| Duke street | Plants, Water feature, Hedges, Excavation, Cedar decking, Lighting |
| Dunbar | Excavation, Patio |
| Dunbar Street | Retaining wall, Excavation, Concrete slabs, Mulch, Lighting, Landscape design plan |
| E. Broadway condo landscape installation | Topsoil, Plants, Raised garden beds, Decretive river rock |
| East 12th Avenue | Artificial grass, Excavation, Concrete slabs, River rock |
| East 22nd | New lawn install, Excavation, Small garden installation |
| Elliott Street | Topsoil, Tree install, Plants, New lawn install, Hedges, Black basalt gravel |
| Elmhurst Drive | New lawn install, Excavation, Micro clover, Paving stone installation |
| Micro Clover Lawn Alternative | Micro clover |
| South Surrey | Excavation, Patio, Interlocking patio, Granite blocks |
| West 11th | Topsoil, Plants, Excavation, Micro clover, Interlocking bricks, Rock boulders, Mulch |
| West 24th | New lawn install, Excavation, Granite pavers, Reshape garden beds |
| West 26th patio installation | Interlocking patio |
| West 31st | Retaining wall, Excavation, Patio, Bobcat work, Irrigation, Seasonal planting, Garden maintenance |
| West 32nd | Plants, New lawn install, Excavation, Patio, Walkway, Pavers |
| West 35th | Retaining wall, Patio, Bamboo removal, Raised garden beds, Aluminum fence, Tree pruning |
| West 35th curb appeal | Hedges, Sedum stonecrop |
| West 6th | Plants, Decking, Concrete slabs, Fencing, Cedar patio |
| West 9th | Vegatable box, Artificial grass, Retaining wall, Excavation, Patio, Interlocking bricks |
| West Vancouver | Plants, New lawn install, Excavation, Driveway, Patio, Bobcat work, Engineered retaining wall, Fencing, Landscape design |
| Wiltshire Street | Excavation, Concrete slabs, Interlocking patio, Ground cover planting |

## 5. Frequency of each raw string

| n | raw string | kind | maps to |
|---|---|---|---|
| 18 | Excavation | process | — |
| 8 | New lawn install | outcome | Lawn installation |
| 8 | Plants | outcome | Planting |
| 7 | Patio | outcome | Patio & paving |
| 6 | Concrete slabs | material | Patio & paving |
| 4 | Retaining wall | outcome | Retaining walls |
| 3 | Artificial grass | outcome | Artificial lawn |
| 3 | Bobcat work | process | — |
| 3 | Hedges | outcome | Hedges |
| 3 | Interlocking bricks | material | Patio & paving |
| 3 | Interlocking patio | outcome | Patio & paving |
| 3 | Micro clover | outcome | Micro clover lawn |
| 3 | Topsoil | material | Garden beds & vegetable boxes |
| 2 | Fencing | outcome | Fencing |
| 2 | Landscape design plan | outcome | Landscape design |
| 2 | Lighting | outcome | Lighting |
| 2 | Mulch | material | Planting |
| 2 | Raised garden beds | outcome | Garden beds & vegetable boxes |
| 2 | Tree install | outcome | Trees & shrubs |
| 1 | Aluminum fence | material | Fencing |
| 1 | Bamboo removal | process | — |
| 1 | Banana trees | outcome | Trees & shrubs |
| 1 | Black basalt gravel | material | Gravel & rock features |
| 1 | Cedar decking | material | Decking |
| 1 | Cedar patio | material | Patio & paving |
| 1 | Composite decking | material | Decking |
| 1 | Decking | outcome | Decking |
| 1 | Decretive river rock | material | Gravel & rock features |
| 1 | Driveway | outcome | Walkways & driveways |
| 1 | Engineered retaining wall | outcome | Retaining walls |
| 1 | Garden bed installation | outcome | Garden beds & vegetable boxes |
| 1 | Garden maintenance | maintenance | — |
| 1 | Garden spotlights | outcome | Lighting |
| 1 | Granite blocks | material | Patio & paving |
| 1 | Granite pavers | material | Patio & paving |
| 1 | Ground cover planting | outcome | Planting |
| 1 | Irrigation | outcome | Irrigation |
| 1 | Landscape design | outcome | Landscape design |
| 1 | Palm trees | outcome | Trees & shrubs |
| 1 | Paved walkway | outcome | Walkways & driveways |
| 1 | Pavers | material | Patio & paving |
| 1 | Paving stone installation | outcome | Patio & paving |
| 1 | Putting green | outcome | Putting green |
| 1 | Raised vegetable garden | outcome | Garden beds & vegetable boxes |
| 1 | Remove stump | process | — |
| 1 | Reshape garden beds | outcome | Garden beds & vegetable boxes |
| 1 | River rock | material | Gravel & rock features |
| 1 | Rock boulders | material | Gravel & rock features |
| 1 | Seasonal planting | maintenance | — |
| 1 | Sedum stonecrop | outcome | Planting |
| 1 | Small garden installation | outcome | Garden beds & vegetable boxes |
| 1 | Tree pruning | maintenance | — |
| 1 | Vegatable box | outcome | Garden beds & vegetable boxes |
| 1 | Walkway | outcome | Walkways & driveways |
| 1 | Water feature | outcome | Water feature |

## 6. Two open questions

* **`Landscape design` (3 mentions) is arguably a process**, not an outcome — it is work rather than a thing
  built. It is also the thing that opens the sales conversation, so it probably stays a service, but that is
  a judgement call rather than something the data settles.
* **`Gravel & rock features` has no outcome-named usage.** It exists as a service only because four
  material mentions (`Black basalt gravel`, `River rock`, `Rock boulders`, `Decretive river rock`) needed a
  parent. Either keep it (gravel/rock gardens are a real design element) or fold those four under
  `Planting` / `Garden beds & vegetable boxes`.

Candidates to *add* if the service list should read as a capability list rather than a transcript of past
work — both are adjacent to work already in the data, and neither appears as an outcome today: **Drainage**
(implied by Excavation and Irrigation) and **Garden structures** (pergolas, arbours, screens — implied by
Decking and Fencing).

## 7. Comparison with the two service pages

**Installation page** names 6 services: Micro clover lawn installation · Retaining walls · Pavers & Patios ·
Fencing · Outdoor garden lights · Artificial lawn.

**Maintenance page** names 2 groups: Garden Maintenance (cultivation and weeding, pruning, planting,
hedging, leaf raking and blowing, lawn and garden bed renovation, seasonal planting) and Lawn Care
(mowing, seasonal aerating, fertilization, power raking moss control, over-seeding).

* The installation page is a **marketing subset**: it omits Planting (10 mentions), Lawn installation (8),
  Garden beds (7), Retaining walls is present but Walkways & driveways (3), Trees & shrubs (4),
  Landscape design (3), Decking, Irrigation, Water feature and Putting green are all missing. Excavation,
  the most common thread in the data, is the one it most needs to address — which is what the new processes
  section does.
* Its "Pavers & Patios" already names the paving cluster as one service, which is exactly the model
  proposed here. The project list is what had drifted.
* The maintenance page's 13 activities appear in the project data essentially never (one mention each of
  Garden maintenance and Tree pruning). Keep the two vocabularies separate — do not try to unify them.
* The abandoned 21-term taxonomy is a genuine head start (it already generalises Trees, Planting, New lawn,
  Gravel, Vegetable box) but repeats the old material/outcome mixing — `Aggregate slabs`, `Concrete slabs`
  and `Gravel` sit beside `Patio` and `Retaining wall`. Rebuild it; do not resurrect it.

## 8. Recommended service list

Lands on **17 installation services**, which resolves both open questions above: `Landscape design` stays a
service (it is the entry point to every project and the thing a client asks for first), and
`Gravel & rock features` gets promoted from material to service, because those four mentions otherwise have
no outcome to belong to. `Trees & shrubs` folds into `Planting` — no client hires tree planting separately
from planting, and both name the same scope.

### Installation services (17, in 6 categories)

Mentions below are **total** — a service's outcome-named mentions plus the material-named ones folded into
it — so they sum to 94 (69 outcome + 25 material) rather than the outcome-only figures in section 1.

| category | service | total mentions | existing page copy? |
|---|---|---|---|
| Design | Landscape design | 3 | new |
| Lawn | Lawn installation | 8 | new |
| Lawn | Micro clover lawn | 3 | **yes** |
| Lawn | Artificial lawn | 3 | **yes** |
| Softscape | Planting — trees, shrubs, perennials, ground cover | 16 | new |
| Softscape | Garden beds & vegetable boxes | 10 | new |
| Softscape | Hedges | 3 | new |
| Hardscape | Patio & paving | 24 | **yes** ("Pavers & Patios") |
| Hardscape | Walkways & driveways | 3 | new |
| Hardscape | Retaining walls | 5 | **yes** |
| Hardscape | Rock & gravel features | 4 | new |
| Structures | Decking | 3 | new |
| Structures | Fencing | 3 | **yes** |
| Structures | Water feature | 1 | new |
| Structures | Putting green | 1 | new |
| Systems | Lighting | 3 | **yes** ("Outdoor garden lights") |
| Systems | Irrigation | 1 | **yes**, but misfiled — see below |

Patio & paving and Planting carry more than half the site's project work between them (40 of 94 mentions),
which is the argument for leading the page with them.

**7 of the 17 already have copy on the page**, so this is a reorganisation plus 10 new sections rather than a
rewrite from nothing. One correction falls out of reading the existing copy: the paragraph under
**Outdoor garden lights** actually describes irrigation ("Customize an automatic irrigation or a drip line
system to keep your lawn and garden healthy") and only then mentions lighting. Irrigation is already a
service on the page — it just has no heading. Split it out.

**Ordering.** The page currently opens with Micro clover lawn installation, which is a niche offering. Lead
with the work that actually recurs, so the order should run roughly: Patio & paving and Planting first, then
Lawn installation and Garden beds, then Retaining walls and the rest.

### Maintenance services (6)

The maintenance page already describes all of these in prose under two headings, so this is structure, not
new copy:

1. **Garden maintenance** — the scheduled program: cultivation and weeding, bed upkeep
2. **Lawn care** — mowing, seasonal aerating, fertilization, power raking moss control, over-seeding
3. **Pruning & hedging**
4. **Seasonal planting & bed renovation**
5. **Mulching**
6. **Leaf & debris clearing** — walkways and driveways

Name the overlapping pair explicitly so the two pages do not read as rivals: installation sells **hedge
planting**, maintenance sells **hedge trimming**. The same applies to planting (installed once) versus
seasonal planting (repeated).

### Processes

Not services anywhere on either page. `Excavation`, machine work, stump removal and invasive removal belong
in the new capability section on the installation page — which the data says is the right place for them,
since Excavation is the most-mentioned item in the whole dataset (18 of 25 projects) and would otherwise be
missing from the site entirely.

### Sequence

1. Fix the two typos (`Vegatable box`, `Decretive river rock`) and lock the 17 + 6 names.
2. Re-tag all 25 projects with outcome services only; the material becomes detail on the card.
3. Rebuild the taxonomy on the 17 outcomes, with the six categories as a parent level.
4. Restructure the installation page to the list above, split Irrigation out from Lighting, add the
   processes section, and reorder to lead with the recurring work.
