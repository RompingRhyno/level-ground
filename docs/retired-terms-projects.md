# Retired terms — the projects behind them

**Status 2026-10-13: brought back as a live service.** The operator created a **Processes** service
(installation group) with covers **Excavation**, **Custom design**, **Stump removal** and
**Bamboo removal**; every project below is tagged accordingly. `Bobcat work` folded into Excavation,
the two design terms into Custom design, and **water feature stays dropped for now**. This file
remains the record of which projects carried each mention, and the redirect destinations still apply.

The complete list of dropped mentions comes from `docs/services-revamp-tags.csv` (rows whose
`service` column is empty — 27 rows across 7 distinct terms):

| Retired term | Mentions | Bucket in the migration |
|---|---|---|
| Excavation | 18 projects | Processes / Site preparation & excavation |
| Bobcat work | 3 projects (West Vancouver, West 31st, Cypress St) | Processes / Site preparation & excavation |
| Landscape design plan | 2 projects (Dunbar Street, Cartier Street) | Design info section (reference only) |
| Landscape design | 1 project (West Vancouver) | Design info section (reference only) |
| Remove stump | 1 project (Alder Street) | Processes / Removal & clearing |
| Bamboo removal | 1 project (West 35th) | Processes / Removal & clearing |
| Water feature | 1 project (Duke Street) | Preserved for reference — not tagged |

Source: `docs/services-revamp-tags.csv` (the migration mapping, where each project's raw mentions
were recorded before consolidation).

## Excavation — 18 projects

Every project the old site attached "Excavation" to. Three of them also carried "Bobcat work"
(marked ★), which the migration treated as the same process.

| Project | Old slug | Old site name |
|---|---|---|
| Wiltshire St | `wiltshire-street-patio-installation` | Wiltshire Street |
| West Vancouver | `west-vancouver-landscaping-installation` | West Vancouver ★ |
| Elmhurst Dr | `elmhurst-drive` | Elmhurst Drive |
| West 31st | `west-31st-patio-installation` | West 31st ★ |
| West 24th | `west-24th` | West 24th |
| South Surrey | `install-outdoor-patio` | South Surrey |
| West 11th | `west-11th-residential-landscaping-installation` | West 11th |
| Alder St | `alder-street-composite-decking` | Alder Street |
| Duke St | `duke-street-decking` | Duke Street |
| Cypress St | `cypress-street-boulevard-garden` | Cypress Street ★ |
| West 32nd | `west-32nd-lawn-installation` | West 32nd |
| Bayswater St | `bayswater-walkway-installation` | Bayswater |
| Dunbar St — Backyard | `dunbar-street-patio-installation` | Dunbar Street |
| East 22nd | `east-22nd-new-lawn-install` | East 22nd |
| West 9th | `west-9th-artificial-turf-installation` | West 9th |
| Dunbar St — Patio | `dunbar-patio-installation` | Dunbar |
| East 12th | `low-maintenance-backyard` | East 12th Avenue |
| Cartier St | `renewed-backyard-with-putting-green` | Cartier Street |

## Design and removal mentions (not tagged)

`Landscape design` (West Vancouver) and `landscape design plan` (Dunbar Street, Cartier Street) were
recorded as reference-only design info — the design work is implied by every project rather than
tagged. `Remove stump` (Alder Street) and `Bamboo removal` (West 35th) sit under Removal & clearing;
both are site-preparation work the same way excavation is.

## Boulevard — no projects

The term existed only as a legacy archive URL (`/residential_landscaping_install/boulevard/`); no
project in the migration carries it.

## Water feature — Duke St only

One mention, on Duke St (`duke-street-decking`), and the migration explicitly recorded it as
"Preserved for reference — not tagged" rather than mapping it to a cover.

## Redirects

All three legacy archive URLs are 301s at cutover, and all three land at the **top of
`/landscape-design-installation`** — decided 2026-10-12 (they are processes or concepts with no
cover and no service section to land on). Implemented in `src/lib/legacy-redirects.ts` and verified
with the rest of the map.
