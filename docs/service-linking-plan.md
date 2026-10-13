# Service linking — wiring audit and plan

Status: **draft for review (2026-10-13).** No code changes beyond what this document proposes.

## The problem

"Cover → its service section" links are built in **four independent places from three different
sources of truth**. They mostly produce the same URL today by convention, not by construction — so
they drift, and the drift is already visible:

- the page editor's link picker can only express page URLs, so the home page's service lists all
  display **"(none)"** while holding correct hand-typed hrefs;
- a service with no section on its page (Processes) yields a link whose hash matches nothing — the
  browser takes the URL, jumps nowhere, and nothing tells the operator why;
- a client component rebuilds links the server already knows, so a service created in the tag modal
  resolves only after a fetch round-trip.

## Current state (audited 2026-10-13)

| Where | Builds | Source of truth | Issue |
|---|---|---|---|
| **TwoColumn service lists** (`/` ×2, 12 links) | literal `href` strings in section data | hand-typed | Editor's `<select>` lists pages only → every row shows "(none)"; anchors hand-maintained |
| **Project-page chips + lightbox pills** | `` `${page}#${slug}` `` in `useServiceLinks` (client) | static list → `/api/services` | Third copy of the rule; custom services resolve late |
| **Collection index pills** (`/projects`) | `` `?service=${slug}` `` | live list | A *filter*, not navigation — but reads as navigation |
| **Service schema** (`lib/seo.ts`) | `` `${pagePath}#${slug}` `` | page section anchors | Fourth copy of the rule |
| **Redirect map** (`next.config.ts`) | static archive → section targets | static list | Fine — a fixed legacy set |
| **Section anchors** | `section.anchor` fields | page data | Nothing enforces cover↔section agreement |

The section inventory today: installation = 10 gallery anchors + a banner that *mentions* Excavation
as prose; maintenance = 2 gallery anchors + a banner. **Processes has no section anywhere.**

## Where the source of truth actually divides (operator's reframe, 2026-10-13)

The **Tag/Service CRUD in the tag modal** is the single source of truth for the *vocabulary*. But
the drift does not live in the vocabulary — it lives in the three layers above it:

| Layer | Holds | Today | Target |
|---|---|---|---|
| **Vocabulary** | tags, services (slug, name, group) | DB tables, CRUD'd from the modal | unchanged — already the source |
| **References** | "this section *is* Pavers & Patios"; "this pill points at Planting" | **strings in content**: hand-typed hrefs in TwoColumn data; anchors that agree with service slugs only by convention | **store the service slug as a reference**; URLs are never stored |
| **Derived** | URLs, chips, pills, schema `@id`s, alt text | built in four places from three sources | built in **one resolver** from the references |

The debt is layer 2: content stores *URLs* where it should store *references*. Everything in layer 3
should be a pure function of layers 1 and 2.

## Propagation — what a mutation must touch

| Mutation | Cascades to | Mechanism |
|---|---|---|
| Tag create / edit / delete | folder tag arrays (done), alts (done), caches | existing revalidation; already wired |
| Service create | nothing — references resolve lazily | none needed |
| Service **rename** | `Tag.service` values, section `service` refs, TwoColumn refs, anchors that used the old slug | one transaction: update refs, revalidate `global:services` + affected pages; the redirect map is static and unaffected |
| Service **delete** | — | **blocked while referenced** (tags, sections, links) — the tag-delete precedent (it names its folders before deleting) |
| Section anchor edits | nothing outward — the resolver reads anchors live | none |

Two invariants that make this hold:

1. **No stored URLs in content.** A link that points at a service stores `service: "planting"`; the
   href is resolved at render. A section that *is* a service stores the same reference; its `anchor`
   becomes an override for non-service sections only.
2. **One write path per layer.** Vocabulary writes go through the tag modal / tags+services routes
   (which revalidate). Content references go through the page editor. Nothing else writes either —
   in particular, maintenance scripts must call the same revalidation helpers or restart the server,
   since `unstable_cache` is file-backed and survives restarts (learned the hard way this week).

## A service is born incomplete (operator's finding, 2026-10-13)

Creating a service today writes the vocabulary row and **nothing else**. But everything that links
to a service needs a **section** to land on, so a fresh service is immediately broken in at least:

- **Project pages' cover chips** → `page#<service>` matches no id; the browser jumps nowhere.
- **Lightbox pills** → same dead hash.
- **The home page's two-column service lists** → hand-typed data; a new service never appears.
- **The Service schema** → one `Service` node per *section anchor*; a sectionless service has no node.

A service therefore has four parts, and creation must produce all of them (or the admin must say
which are missing):

1. the vocabulary row (exists),
2. **a section on its page** — a skeleton gallery with the service reference and a default heading,
3. **covers** — tags filed under it (can lag; alt text just skips it),
4. **listing entries** — wherever the site lists services, which should be vocabulary-driven, not
   hand-typed.

### The create cascade (proposed)

`POST /api/services` additionally appends a section to the right service page (installation or
maintenance, by group): a gallery with `service: <slug>` bound, an empty pick list, and a heading
defaulted to the service name — so every link written the moment the service exists resolves to a
real anchor. The page's editor then treats it like any other section (reorder, retitle, add picks).

### Listings become vocabulary-driven (proposed)

The home page's two columns are a *service menu*; today their twelve links are hand-typed. Give the
TwoColumn a list mode — "links: from the service vocabulary, group X" — so a new service appears
automatically and a rename propagates. Manual entries stay available for anything not a service.

### Everywhere a service surfaces (the sweep)

| Surface | Source today | Reads the live vocabulary? |
|---|---|---|
| Project chips + lightbox pills | the tag's `service` → resolver | yes (fixed this week) |
| Home two columns | hand-typed links | **no** → item 4 above |
| `/projects` service pills | live list | yes |
| Page-editor pickers (service dropdowns) | live list + static fallback | yes |
| Service schema nodes | section anchors | yes, once a section exists |
| Alt generator | the tag's service (names only) | yes |
| Tag modal's service select | live list | yes |
| **Tag's service reassignment** | — | **no UI exists** to move a tag to another service |
| Redirect map (`next.config.ts`) | static, frozen legacy set | deliberately not coupled |

## Proposed admin shape (operator, 2026-10-13): the expanded tag modal + a gallery service dropdown

Two moves: **expand the tag modal into the vocabulary's CRUD** (services included: create, rename,
regroup, reorder, delete; tags gain move-to-another-service), and **add a "service link" dropdown to
the gallery component** that binds a section to a service, listing unlinked services and graying the
linked ones. The idea holds; the gaps to design around:

**Resolved / corrected 2026-10-13 (operator):**

1. **Scope — solved by the revamped tag box.** The folder page's tag section is redrawn with tags
   visually grouped under their services, plus an "Add service" action that makes the category
   relationship legible. The modal edits global vocabulary; the box shows it in context.
   *One design point to settle:* the box then shows tags grouped by service, while the alt list
   depends on the folder's ordered tags (first four). Proposal: two zones — "In this project"
   (ordered, drag, the alt list) and "Add from services" (grouped browse).
2. **Dropdown scope — withdrawn.** A service's section may live on **any** page; the resolver finds
   it by reference and links there. (A home-page gallery bound to `planting` means the cover chips
   point at the home section.) The service's *group* only sets the **default** page for the
   skeleton section the create cascade makes — not where links resolve.
3. **`anchor` vs `service`, restated.** Today `anchor` is a free-text id on a section; on the two
   service pages those strings are service slugs *by convention*, hand-typed, and can drift. The
   proposal adds `service` — a **reference** (a pick from the live list) meaning "this section is
   Planting". Binding it derives the id from the reference and disables the free-text anchor, which
   then survives only for non-service sections that need a jump target.
4. **Unlink — solved.** The dropdown carries an explicit "(none)" entry; choosing it frees the
   binding so the service can be linked elsewhere.
5. **Regroup moves the section** — same cascade class as rename; managed in the CRUD transaction.
6. **Delete confirmation enumerates references** — tags, its section, listing rows — the tag-delete
   precedent.
7. **Freshness** — the linked-set read goes through the resolver's cached read, invalidated by the
   same cache tags on every write.

Also noted: service mentions in *non-gallery* sections (the installation page's bottom banner names
Excavation in prose) stay plain text — the dropdown only exists on galleries. Acceptable, but worth
being deliberate about.

## Target design

1. **One resolver, server-side:** `getServiceLinkMap()` → `slug → { name, group, page, anchor, href,
   hasSection }`. One place knows how a service maps to a URL.
2. **`/api/services` returns the resolved `href`.** The client hook consumes it instead of building
   URLs; the static fallback shrinks to "before the fetch completes".
3. **TwoColumn links store the service slug**, resolved at render. The editor gets a service picker
   (name + group), with a raw-URL escape hatch for odd cases. Existing data migrates href→slug.
4. **Sectionless services resolve to the page (no hash)** so a link always lands somewhere sensible,
   with an admin hint in the picker ("no section yet").
5. **The index pills stay a filter** (see decision 2) — but the wording in the plan is explicit
   about that being a choice, not an accident.
6. **The schema** consumes the same resolver where practical; the redirect map keeps its own static
   table (a frozen legacy set, deliberately not coupled).

## Migration steps

1. Add `lib/service-links.ts` (server; cached): reads the Service table + both service pages'
   section anchors (`anchor` OR a new `service` reference on the section); exposes
   `getServiceLinkMap()` and `resolveServiceHref(slug)`. Sections gain
   `service?: string` — the real reference — with `anchor` demoted to an override.
2. `/api/services` gains `href` per service; the client hook simplifies to a consumer.
3. TwoColumn: type gains `service?: string` (href kept as fallback); editor gains the service picker;
   render resolves via the map; migrate the 12 home links.
4. Chips and lightbox: no visible change — they consume the same map.
5. Editor polish: a "(no section yet)" hint on services whose `hasSection` is false.
6. Verify end to end: a chip's href, the editor showing names, a sectionless service landing on the
   page, and the 12 migrated links unchanged in output.

## Decisions needed

*(Operator: lower priority than the source-of-truth design above — listed for when the wiring work
is under way.)*

1. **TwoColumn links:** store service slugs (recommended — the editor works, the label derives from
   the service name) or keep raw hrefs and only fix the picker's display?
2. **Collection index pills:** keep them as filters (recommended) or make them navigate to the
   service pages? (The current behavior is a filter; changing it changes how people browse /projects.)
3. **Sectionless services:** resolve to the page + an admin hint (recommended), or require a section
   before a service can be created?
4. **Link labels in TwoColumn:** derive from the service name with an optional override (recommended)
   or stay free text?
