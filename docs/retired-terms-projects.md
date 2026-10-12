# Retired terms — the projects behind them

Kept for future reference, per the operator: these three legacy terms were dropped from the cover
vocabulary, but their project associations are worth having on hand (e.g. if "excavation" ever
becomes a service line, this is the ready-made proof of experience).

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

## Boulevard — no projects

The term existed only as a legacy archive URL (`/residential_landscaping_install/boulevard/`); no
project in the migration carries it.

## Water feature — Duke St only

One mention, on Duke St (`duke-street-decking`), and the migration explicitly recorded it as
"Preserved for reference — not tagged" rather than mapping it to a cover.

## Redirects

All three legacy archive URLs still need 301s at cutover. Since the terms were not kept, the
destinations are the closest service section (see `docs/seo-metadata-proposal.md`):
`boulevard` → planting, `excavation` → the installation page (no matching service section),
`water_feature` → rock-and-gravel-features.
