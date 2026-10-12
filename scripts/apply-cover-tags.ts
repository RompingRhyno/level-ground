/**
 * Tag folders with the specific covers they earned, each tag sitting under a service.
 *
 * The two layers are deliberately distinct:
 *   - **tags** are the specific covers, taken from `docs/services-revamp-tags.csv` (the `detail`
 *     column, one row per mention scraped from the old site) — Patio, Hedges, Micro clover …
 *   - **services** are the categories above them (`Tag.service`) — Pavers & Patios, Planting,
 *     Lawn installation … A service page or the gallery picker gathers its covers by asking for the
 *     tags whose `service` matches, then resolves those through the folders carrying them.
 *
 * Assignments come from the CSV, so the audit stays the source of truth: edit the CSV, re-run.
 * A `detail` of `—` means the mention is intentionally not a cover (dropped), and is skipped.
 *
 * Coverage names live in COVERS, which is also what retires old vocabulary: any slug listed in
 * RETIRE that no folder references afterwards is deleted, so renames do not leave orphans behind.
 *
 * Dry run by default. Flags:
 *   --apply    write the changes
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { readFileSync } from "fs";
import { join } from "path";

const APPLY = process.argv.includes("--apply");

/** Minimal CSV reader: RFC4180 quoting, no dependencies. */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows.filter((r) => r.length > 1 || (r[0] ?? "").trim());
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

/**
 * The cover vocabulary. `detail` is the join key into the CSV (exact, after the `material: `
 * prefix is stripped); `name`/`slug` are the tag's identity in the admin and in a query.
 */
type Cover = { detail: string; name: string; slug: string; service: string };
const PAVERS = "pavers-and-patios";
const PLANTING = "planting";
const LAWN = "lawn-installation";
const BEDS = "garden-beds-and-boxes";
const RETAIN = "retaining-walls";
const ROCK = "rock-and-gravel-features";
const DECKING = "decking";
const FENCING = "fencing";
const LIGHTING = "outdoor-lighting";
const IRRIGATION = "irrigation";
const MAINT = "garden-maintenance";
const cover = (detail: string, name: string, slug: string, service: string): Cover => ({ detail, name, slug, service });

const COVERS: Cover[] = [
  // Pavers & Patios
  cover("Interlocking pavers", "Interlocking pavers", "interlocking-pavers", PAVERS),
  cover("Concrete slabs", "Concrete slabs", "concrete-slabs", PAVERS),
  cover("Natural stone pavers", "Natural stone pavers", "natural-stone-pavers", PAVERS),
  cover("Flagstone pavers", "Flagstone pavers", "flagstone-pavers", PAVERS),
  cover("Cedar patio", "Cedar patio", "cedar-patio", PAVERS),
  cover("Concrete walkway", "Concrete walkway", "concrete-walkway", PAVERS),
  // Planting
  cover("Plants", "Plants", "plants", PLANTING),
  cover("Trees", "Trees", "trees", PLANTING),
  cover("Hedges", "Hedges", "hedges", PLANTING),
  cover("mulch", "Mulch", "mulch", PLANTING),
  cover("Topsoil", "Topsoil", "topsoil", PLANTING),
  // Lawn installation
  cover("Sod lawn", "Sod lawn", "sod-lawn", LAWN),
  cover("Micro clover", "Micro clover", "micro-clover", LAWN),
  cover("Artificial turf", "Artificial turf", "artificial-turf", LAWN),
  cover("Putting green", "Putting green", "putting-green", LAWN),
  // Garden beds & boxes
  cover("Garden beds", "Garden beds", "garden-beds", BEDS),
  cover("Garden boxes", "Garden boxes", "garden-boxes", BEDS),
  // Retaining walls — the plain cover, plus an engineered one where the wall was actually engineered
  // (the distinction is not cosmetic: an engineered wall is the thing a bylaw or a permit cares about)
  cover("Retaining walls", "Retaining walls", "retaining-walls", RETAIN),
  cover("Engineered retaining wall", "Engineered retaining wall", "engineered-retaining-wall", RETAIN),
  // Rock & gravel features
  cover("River rock", "River rock", "river-rock", ROCK),
  cover("Basalt gravel", "Basalt gravel", "basalt-gravel", ROCK),
  cover("Boulders", "Boulders", "boulders", ROCK),
  // Decking
  cover("Cedar", "Cedar decking", "cedar-decking", DECKING),
  cover("Composite", "Composite decking", "composite-decking", DECKING),
  // Fencing
  cover("Cedar fencing", "Cedar fencing", "cedar-fencing", FENCING),
  cover("Aluminum", "Aluminum fencing", "aluminum-fencing", FENCING),
  // Outdoor Lighting — single cover, named for its service
  cover("Outdoor Lighting", "Outdoor Lighting", "outdoor-lighting", LIGHTING),
  // Irrigation — single cover, named for its service
  cover("Irrigation", "Irrigation", "irrigation", IRRIGATION),
  // Garden maintenance
  cover("Scheduled maintenance", "Scheduled maintenance", "scheduled-maintenance", MAINT),
  cover("Tree pruning", "Tree pruning", "tree-pruning", MAINT),
  cover("Seasonal planting", "Seasonal planting", "seasonal-planting", MAINT),
];

/** Superseded slugs, pruned after reassignment if nothing references them any more. */
const RETIRE = [
  "patio", "driveway", "paving-stone", "small-gardens", "decking-generic", "walkway", "fencing-generic",
  "concrete-slab", "interlocking-brick", "natural-stone", "shrubs-perennials-ground-cover",
  "engineered-retaining-walls", "garden-landscape-lighting", "automatic-irrigation", "vegetable-boxes",
  "granite-pavers", "stone-pavers",
];

const DROPPED = "—";

async function main() {
  const root = join(__dirname, "..");
  const tagsCsv = parseCsv(readFileSync(join(root, "docs/services-revamp-tags.csv"), "utf8"));
  const mapCsv = parseCsv(readFileSync(join(root, "docs/folder-mapping-descriptions.csv"), "utf8"));

  const oldToNew = new Map<string, string>();
  for (const r of mapCsv) if (r.old_slug) oldToNew.set(r.old_slug, r.new_slug);

  const byDetail = new Map<string, Cover>();
  for (const c of COVERS) byDetail.set(c.detail, c);

  const seenDetails = new Set<string>();
  const perFolder = new Map<string, Set<string>>();
  let droppedRows = 0;
  for (const r of tagsCsv) {
    if (!r.service) continue;
    const detail = r.detail.trim().replace(/^material:\s*/, "");
    if (detail === DROPPED) { droppedRows++; continue; }
    seenDetails.add(detail);
    const c = byDetail.get(detail);
    if (!c) throw new Error(`CSV detail has no cover defined: "${detail}"`);
    const folder = oldToNew.get(r.project_slug);
    if (!folder) continue;
    if (!perFolder.has(folder)) perFolder.set(folder, new Set());
    perFolder.get(folder)!.add(c.name);
  }
  const unused = COVERS.filter((c) => !seenDetails.has(c.detail));
  console.log(`covers defined: ${COVERS.length} | used by assignments: ${seenDetails.size} | dropped rows: ${droppedRows}`);
  if (unused.length) console.log("covers with no assignment (still created):", unused.map((c) => c.name).join(", "));

  const { default: prisma } = await import("../src/lib/prisma");

  // pre-flight: every target must exist, because a half-applied run is worse than none
  const existingSlugs = new Set(
    (await prisma.folder.findMany({ select: { slug: true } })).map((f) => f.slug),
  );
  const missing = [...perFolder.keys()].filter((s) => !existingSlugs.has(s));
  if (missing.length) {
    throw new Error(
      `plan refers to folder(s) that do not exist: ${missing.join(", ")} — correct docs/folder-mapping-descriptions.csv first`,
    );
  }

  // 1) create/refresh the cover tags
  let created = 0, updated = 0;
  for (const c of COVERS) {
    const hit = await prisma.tag.findUnique({ where: { slug: c.slug } });
    if (!hit) {
      created++;
      if (APPLY) await prisma.tag.create({ data: { name: c.name, slug: c.slug, service: c.service } });
    } else if (hit.name !== c.name || hit.service !== c.service) {
      updated++;
      if (APPLY) await prisma.tag.update({ where: { id: hit.id }, data: { name: c.name, service: c.service } });
    }
  }
  console.log(`\ncover tags: ${created} to create, ${updated} to update`);

  // 2) assign covers to folders
  const byName = new Map(COVERS.map((c) => [c.name, c]));
  console.log(`\nfolders: ${perFolder.size}`);
  for (const [folder, names] of [...perFolder].sort()) {
    console.log(`  ${folder.padEnd(22)} ${[...names].map((n) => byName.get(n)!.slug).sort().join(", ")}`);
  }

  if (APPLY) {
    for (const [folder, names] of perFolder) {
      const current =
        (await prisma.folder.findUnique({ where: { slug: folder }, select: { tags: true } }))?.tags ?? [];
      // Replace any cover this folder no longer earns, keep anything unrecognised (before/after markers).
      const known = new Set([...COVERS.map((c) => c.slug), ...RETIRE]);
      const keep = current.filter((t) => !known.has(t));
      const next = [...new Set([...keep, ...[...names].map((n) => byName.get(n)!.slug)])].sort();
      await prisma.folder.update({ where: { slug: folder }, data: { tags: next } });
    }

    // 3) prune superseded tags that nothing references
    const all = await prisma.folder.findMany({ select: { slug: true, tags: true } });
    const referenced = new Set(all.flatMap((f: any) => f.tags ?? []));
    let removed = 0;
    for (const slug of RETIRE) {
      const hit = await prisma.tag.findUnique({ where: { slug } });
      if (!hit) continue;
      if (referenced.has(slug)) { console.log(`  kept ${slug} (still referenced)`); continue; }
      await prisma.tag.delete({ where: { id: hit.id } });
      removed++;
    }
    console.log(`\napplied: ${removed} superseded tag(s) removed`);
  } else {
    console.log("\ndry run — re-run with --apply. Nothing was changed.");
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
