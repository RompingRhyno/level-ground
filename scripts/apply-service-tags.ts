/**
 * Apply the service tag vocabulary to folders.
 *
 * Source of truth is the committed audit output:
 *   docs/services-revamp-tags.csv        one row per service mention, with the final `service` name
 *   docs/folder-mapping-descriptions.csv  old project slug -> the folder that replaced it
 *
 * Tags are slugs on `Folder.tags` pointing at `Tag` rows, and `getFirstAssetUrlsByTagSlugs` turns a
 * tag into a cover by finding folders tagged with it — so this is the wiring a service page needs to
 * show its gallery.
 *
 * The four tags that already existed are earlier drafts of services, so they are reconciled in
 * place: same row id, corrected name and slug, and every folder referencing them is re-pointed.
 * Slugs are the public query key, so after this they should stay stable and renames stay name-only.
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

/** Final service vocabulary. Order here is the order tags are created. */
const VOCAB: Record<string, string> = {
  "Pavers & Patios": "pavers-and-patios",
  Planting: "planting",
  "Lawn installation": "lawn-installation",
  "Garden beds & boxes": "garden-beds-and-boxes",
  "Retaining walls": "retaining-walls",
  "Rock & gravel features": "rock-and-gravel-features",
  Decking: "decking",
  Fencing: "fencing",
  "Outdoor Lighting": "outdoor-lighting",
  Irrigation: "irrigation",
  "Lawn maintenance": "lawn-maintenance",
  "Garden maintenance": "garden-maintenance",
};

/** Existing tag slug -> [final name, final slug]. Reconciled in place so ids and references survive. */
const RECONCILE: Record<string, [string, string]> = {
  "interlocking-pavers": ["Pavers & Patios", "pavers-and-patios"],
  "plant-installation": ["Planting", "planting"],
  "irrigation-system": ["Irrigation", "irrigation"],
  "lawn-installation": ["Lawn installation", "lawn-installation"],
};

async function main() {
  const root = join(__dirname, "..");
  const tagsCsv = parseCsv(readFileSync(join(root, "docs/services-revamp-tags.csv"), "utf8"));
  const mapCsv = parseCsv(readFileSync(join(root, "docs/folder-mapping-descriptions.csv"), "utf8"));

  const oldToNew = new Map<string, string>();
  for (const r of mapCsv) if (r.old_slug) oldToNew.set(r.old_slug, r.new_slug);

  const perFolder = new Map<string, Set<string>>();
  const usedServices = new Set<string>();
  for (const r of tagsCsv) {
    if (!r.service) continue;
    const folder = oldToNew.get(r.project_slug);
    if (!folder) continue;
    usedServices.add(r.service);
    if (!perFolder.has(folder)) perFolder.set(folder, new Set());
    perFolder.get(folder)!.add(r.service);
  }

  const unknown = [...usedServices].filter((s) => !VOCAB[s]);
  if (unknown.length) throw new Error(`service(s) missing from VOCAB: ${unknown.join(", ")}`);

  const { default: prisma } = await import("../src/lib/prisma");

  // 1) reconcile the draft tags in place
  console.log("tag reconciliation:");
  for (const [oldSlug, [name, newSlug]] of Object.entries(RECONCILE)) {
    const existing = await prisma.tag.findUnique({ where: { slug: oldSlug } });
    if (!existing) { console.log(`  (absent) ${oldSlug}`); continue; }
    console.log(`  ${oldSlug}  ->  ${newSlug}  name "${existing.name}" -> "${name}"`);
    if (APPLY && oldSlug !== newSlug) {
      await prisma.tag.update({ where: { id: existing.id }, data: { name, slug: newSlug } });
    } else if (APPLY) {
      await prisma.tag.update({ where: { id: existing.id }, data: { name } });
    }
  }

  // 2) create any vocabulary rows still missing (reconciled slugs already exist after step 1)
  const reconciledTargets = new Set(Object.values(RECONCILE).map(([, slug]) => slug));
  const toCreate: string[] = [];
  for (const [name, slug] of Object.entries(VOCAB)) {
    if (reconciledTargets.has(slug)) continue;
    const hit = await prisma.tag.findUnique({ where: { slug } });
    if (!hit) toCreate.push(`${name} [${slug}]`);
  }
  console.log(`\ntags to create (${toCreate.length}): ${toCreate.join(", ") || "none"}`);
  if (APPLY) {
    for (const [name, slug] of Object.entries(VOCAB)) {
      if (reconciledTargets.has(slug)) continue;
      const hit = await prisma.tag.findUnique({ where: { slug } });
      if (!hit) await prisma.tag.create({ data: { name, slug } });
    }
  }

  // 3) re-point every folder that referenced a draft slug
  const allFolders = await prisma.folder.findMany({ select: { slug: true, tags: true } });
  let repointed = 0;
  for (const f of allFolders) {
    const next = f.tags.map((t) => (RECONCILE[t] ? RECONCILE[t][1] : t));
    if (next.join() === f.tags.join()) continue;
    repointed++;
    console.log(`  re-point ${f.slug}: ${f.tags.join(", ")} -> ${next.join(", ")}`);
    if (APPLY) await prisma.folder.update({ where: { slug: f.slug }, data: { tags: [...new Set(next)] } });
  }
  console.log(`\nfolders re-pointed: ${repointed}`);

  // pre-flight: every target must exist, because a half-applied run is worse than none
  const existingSlugs = new Set(
    (await prisma.folder.findMany({ select: { slug: true } })).map((f) => f.slug),
  );
  const missingTargets = [...perFolder.keys()].filter((s) => !existingSlugs.has(s));
  if (missingTargets.length) {
    throw new Error(
      `plan refers to folder(s) that do not exist: ${missingTargets.join(", ")} — correct docs/folder-mapping-descriptions.csv first`,
    );
  }

  // 4) apply the service tags
  console.log(`\nfolders to tag: ${perFolder.size}`);
  for (const [folder, services] of [...perFolder].sort()) {
    console.log(`  ${folder.padEnd(22)} ${toSlugs(services).join(", ")}`);
  }
  if (APPLY) {
    for (const [folder, services] of perFolder) {
      const current =
        (await prisma.folder.findUnique({ where: { slug: folder }, select: { tags: true } }))?.tags ?? [];
      const serviceSlugs = toSlugs(services);
      // Keep any non-service tags already on the folder; PRUNE also drops service tags it no longer earns.
      const kept = current.filter((t) => !SERVICE_SLUGS.has(t));
      const next = [...new Set([...kept, ...serviceSlugs])].sort();
      await prisma.folder.update({ where: { slug: folder }, data: { tags: next } });
    }
    console.log("\napplied");
  } else {
    console.log("\ndry run — re-run with --apply. Nothing was changed.");
  }

  await prisma.$disconnect();
}

const SERVICE_SLUGS = new Set(Object.values(VOCAB));

/** Service names -> their slugs, sorted. */
const toSlugs = (names: Set<string> | string[]): string[] =>
  [...names].map((n) => VOCAB[n] ?? n).sort();

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
