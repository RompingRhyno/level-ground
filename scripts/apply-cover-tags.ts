/**
 * Tag folders with the specific covers they earned, each tag sitting under a service.
 *
 * The two layers are deliberately distinct:
 *   - **tags** are the specific covers, taken from the consolidated list in
 *     `docs/services-revamp-tags.csv` (one row per mention, `detail` column) — Patio, Hedges,
 *     Micro clover, Interlocking brick …
 *   - **services** are the categories above them (`Tag.service`) — Pavers & Patios, Planting,
 *     Lawn installation … A service page or the gallery picker gathers its covers by asking for the
 *     tags whose `service` matches, then resolves those through the folders carrying them.
 *
 * The earlier pass tagged folders with service names and left the covers unrepresented; this script
 * creates the covers, assigns them, and removes the service-level tags (nothing else references them).
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
 * The consolidated covers. `detail` must match the CSV exactly — that is the join key — while
 * `name`/`slug` are the tag's identity in the admin and in a public query.
 */
type Cover = { detail: string; name: string; slug: string; service: string };
const COVERS: Cover[] = [
  // Pavers & Patios
  { detail: "Patio", name: "Patio", slug: "patio", service: "pavers-and-patios" },
  { detail: "Walkway", name: "Walkway", slug: "walkway", service: "pavers-and-patios" },
  { detail: "Driveway", name: "Driveway", slug: "driveway", service: "pavers-and-patios" },
  { detail: "interlocking brick", name: "Interlocking brick", slug: "interlocking-brick", service: "pavers-and-patios" },
  { detail: "concrete slab", name: "Concrete slab", slug: "concrete-slab", service: "pavers-and-patios" },
  { detail: "natural stone (granite)", name: "Natural stone (granite)", slug: "natural-stone", service: "pavers-and-patios" },
  { detail: "paving stone", name: "Paving stone", slug: "paving-stone", service: "pavers-and-patios" },
  // Planting
  { detail: "Trees", name: "Trees", slug: "trees", service: "planting" },
  { detail: "Shrubs, perennials & ground cover", name: "Shrubs, perennials & ground cover", slug: "shrubs-perennials-ground-cover", service: "planting" },
  { detail: "Hedges", name: "Hedges", slug: "hedges", service: "planting" },
  { detail: "mulch", name: "Mulch", slug: "mulch", service: "planting" },
  // Lawn installation
  { detail: "Sod lawn", name: "Sod lawn", slug: "sod-lawn", service: "lawn-installation" },
  { detail: "Micro clover", name: "Micro clover", slug: "micro-clover", service: "lawn-installation" },
  { detail: "Artificial turf", name: "Artificial turf", slug: "artificial-turf", service: "lawn-installation" },
  { detail: "Putting green", name: "Putting green", slug: "putting-green", service: "lawn-installation" },
  // Garden beds & boxes
  { detail: "Garden beds (new, raised, reshaped)", name: "Garden beds", slug: "garden-beds", service: "garden-beds-and-boxes" },
  { detail: "Vegetable boxes", name: "Vegetable boxes", slug: "vegetable-boxes", service: "garden-beds-and-boxes" },
  { detail: "Small gardens", name: "Small gardens", slug: "small-gardens", service: "garden-beds-and-boxes" },
  { detail: "topsoil / soil amendment", name: "Topsoil / soil amendment", slug: "topsoil", service: "garden-beds-and-boxes" },
  // Retaining walls
  { detail: "Engineered systems", name: "Engineered retaining walls", slug: "engineered-retaining-walls", service: "retaining-walls" },
  // Rock & gravel features
  { detail: "River rock", name: "River rock", slug: "river-rock", service: "rock-and-gravel-features" },
  { detail: "Basalt gravel", name: "Basalt gravel", slug: "basalt-gravel", service: "rock-and-gravel-features" },
  { detail: "Boulders", name: "Boulders", slug: "boulders", service: "rock-and-gravel-features" },
  // Decking
  { detail: "Cedar", name: "Cedar decking", slug: "cedar-decking", service: "decking" },
  { detail: "Composite", name: "Composite decking", slug: "composite-decking", service: "decking" },
  { detail: "Decking (generic)", name: "Decking (generic)", slug: "decking-generic", service: "decking" },
  // Fencing
  { detail: "Aluminum", name: "Aluminum fencing", slug: "aluminum-fencing", service: "fencing" },
  { detail: "Fencing (generic)", name: "Fencing (generic)", slug: "fencing-generic", service: "fencing" },
  // Outdoor Lighting
  { detail: "Garden & landscape lighting", name: "Garden & landscape lighting", slug: "garden-landscape-lighting", service: "outdoor-lighting" },
  // Irrigation
  { detail: "Automatic irrigation / drip line", name: "Automatic irrigation / drip line", slug: "automatic-irrigation", service: "irrigation" },
  // Garden maintenance
  { detail: "Scheduled maintenance", name: "Scheduled maintenance", slug: "scheduled-maintenance", service: "garden-maintenance" },
  { detail: "Tree pruning", name: "Tree pruning", slug: "tree-pruning", service: "garden-maintenance" },
  { detail: "Seasonal planting", name: "Seasonal planting", slug: "seasonal-planting", service: "garden-maintenance" },
];

/** Service-level tags from the previous pass. Nothing else references them; they become `service`. */
const SERVICE_TAGS = [
  "pavers-and-patios", "planting", "lawn-installation", "garden-beds-and-boxes", "retaining-walls",
  "rock-and-gravel-features", "decking", "fencing", "outdoor-lighting", "irrigation",
  "lawn-maintenance", "garden-maintenance",
];

async function main() {
  const root = join(__dirname, "..");
  const tagsCsv = parseCsv(readFileSync(join(root, "docs/services-revamp-tags.csv"), "utf8"));
  const mapCsv = parseCsv(readFileSync(join(root, "docs/folder-mapping-descriptions.csv"), "utf8"));

  const oldToNew = new Map<string, string>();
  for (const r of mapCsv) if (r.old_slug) oldToNew.set(r.old_slug, r.new_slug);

  const byDetail = new Map<string, Cover>();
  for (const c of COVERS) byDetail.set(c.detail, c);

  // every CSV detail must map to a cover, or an assignment would be silently dropped
  const seenDetails = new Set<string>();
  const perFolder = new Map<string, Set<string>>();
  for (const r of tagsCsv) {
    if (!r.service) continue;
    // material rows carry a "material: " prefix in the CSV; the cover name is what follows
    const detail = r.detail.trim().replace(/^material:\s*/, "");
    seenDetails.add(detail);
    const cover = byDetail.get(detail);
    if (!cover) throw new Error(`CSV detail has no cover defined: "${detail}"`);
    const folder = oldToNew.get(r.project_slug);
    if (!folder) continue;
    if (!perFolder.has(folder)) perFolder.set(folder, new Set());
    perFolder.get(folder)!.add(cover.name);
  }
  const unmapped = COVERS.filter((c) => !seenDetails.has(c.detail));
  console.log(`covers defined: ${COVERS.length} | used by assignments: ${seenDetails.size}`);
  if (unmapped.length) console.log("covers with no assignment (kept, unused):", unmapped.map((c) => c.name).join(", "));

  const { default: prisma } = await import("../src/lib/prisma");

  // pre-flight
  const existingSlugs = new Set((await prisma.folder.findMany({ select: { slug: true } })).map((f) => f.slug));
  const missing = [...perFolder.keys()].filter((s) => !existingSlugs.has(s));
  if (missing.length) throw new Error(`plan refers to folder(s) that do not exist: ${missing.join(", ")}`);
  const collisions = COVERS.filter((c) => SERVICE_TAGS.includes(c.slug));
  if (collisions.length) throw new Error(`cover slug collides with a service slug: ${collisions.map((c) => c.slug).join(", ")}`);

  // 1) create/refresh the cover tags
  let created = 0, updated = 0;
  for (const c of COVERS) {
    const hit = await prisma.tag.findUnique({ where: { slug: c.slug } });
    if (!hit) { created++; if (APPLY) await prisma.tag.create({ data: { name: c.name, slug: c.slug, service: c.service } }); }
    else if (hit.name !== c.name || hit.service !== c.service) {
      updated++;
      if (APPLY) await prisma.tag.update({ where: { id: hit.id }, data: { name: c.name, service: c.service } });
    }
  }
  console.log(`\ncover tags: ${created} to create, ${updated} to update`);

  // 2) assign covers to folders, dropping the service-level slugs
  console.log(`\nfolders: ${perFolder.size}`);
  const byName = new Map(COVERS.map((c) => [c.name, c]));
  for (const [folder, names] of [...perFolder].sort()) {
    console.log(`  ${folder.padEnd(22)} ${[...names].map((n) => byName.get(n)!.slug).sort().join(", ")}`);
  }

  if (APPLY) {
    for (const [folder, names] of perFolder) {
      const current = (await prisma.folder.findUnique({ where: { slug: folder }, select: { tags: true } }))?.tags ?? [];
      const keep = current.filter((t) => !SERVICE_TAGS.includes(t));
      const next = [...new Set([...keep, ...[...names].map((n) => byName.get(n)!.slug)])].sort();
      await prisma.folder.update({ where: { slug: folder }, data: { tags: next } });
    }
    // 3) strip service slugs from any folder that still carries them, then remove the tag rows
    const all = await prisma.folder.findMany({ select: { slug: true, tags: true } });
    let stripped = 0;
    for (const f of all) {
      const next = f.tags.filter((t) => !SERVICE_TAGS.includes(t));
      if (next.length === f.tags.length) continue;
      stripped++;
      console.log(`  stripped service tags from ${f.slug} (now: ${next.join(", ") || "none"})`);
      await prisma.folder.update({ where: { slug: f.slug }, data: { tags: next } });
    }
    let removed = 0;
    for (const slug of SERVICE_TAGS) {
      const hit = await prisma.tag.findUnique({ where: { slug } });
      if (hit) { await prisma.tag.delete({ where: { id: hit.id } }); removed++; }
    }
    console.log(`\napplied: ${stripped} folder(s) cleaned, ${removed} service tags removed`);
  } else {
    console.log("\ndry run — re-run with --apply. Nothing was changed.");
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
