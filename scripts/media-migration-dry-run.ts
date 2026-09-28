/**
 * Migration step 2 — read-only dry run.
 *
 * Compares the converted JPEG tree against the database, folder by folder, and reports what each stored
 * asset needs. Writes nothing, anywhere. Plan: docs/media-migration-plan.md.
 *
 *   npx tsx scripts/media-migration-dry-run.ts [--json <path>]
 *
 * Actions reported per file:
 *   upgrade     stored object is a PNG → upload the converted JPEG under a new key, update the row in place
 *   rename-only stored object is already a JPEG but the name changed → update `filename` only; the object,
 *               its key and its URL stay as they are (no re-upload, no cache churn)
 *   keep        already a JPEG under the same name → untouched
 *   create      no row exists for this file → upload and create a row
 *   dupe        a second row shares folder + filename → delete (decision 3)
 *   orphan      a row with no file on disk → reported, never touched
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

import { readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { JPG_ROOT, MAP, canonicalStem, stem, mb } from "./media-migration-map";

type Row = {
  id: string;
  folder: string | null;
  filename: string | null;
  storageKey: string;
  publicUrl: string | null;
  mime: string | null;
  size: number | null;
  orderIndex: number | null;
};

async function main() {
  const prisma = (await import("../src/lib/prisma")).default;

  const folders = await prisma.folder.findMany({ select: { slug: true, name: true, hidden: true } });
  const rows: Row[] = await prisma.asset.findMany({
    select: { id: true, folder: true, filename: true, storageKey: true, publicUrl: true, mime: true, size: true, orderIndex: true },
    orderBy: [{ folder: "asc" }, { orderIndex: "asc" }],
  });

  const rowsByFolder = new Map<string, Row[]>();
  for (const r of rows) {
    if (!r.folder) continue;
    if (!rowsByFolder.has(r.folder)) rowsByFolder.set(r.folder, []);
    rowsByFolder.get(r.folder)!.push(r);
  }

  const mapped = new Set(MAP.map(([, slug]) => slug));
  const uncovered = folders.filter((f) => !f.hidden && !mapped.has(f.slug));
  const missingDirs: string[] = [];
  const report: {
    local: string;
    slug: string;
    name: string;
    counts: Record<string, number>;
    bytesToUpload: number;
    details: string[];
  }[] = [];

  const totals = { upgrade: 0, "rename-only": 0, keep: 0, create: 0, dupe: 0, orphan: 0, bytesToUpload: 0 };

  for (const [localDir, slug] of MAP) {
    const dir = path.join(JPG_ROOT, localDir);
    let entries: string[] = [];
    try {
      entries = (await readdir(dir, { withFileTypes: true })).filter((e) => e.isFile()).map((e) => e.name);
    } catch {
      missingDirs.push(`${localDir} → ${slug} (no directory at ${dir})`);
      continue;
    }

    const folderRows = rowsByFolder.get(slug) ?? [];
    const byCanonical = new Map<string, Row[]>();
    for (const r of folderRows) {
      const key = canonicalStem(slug, r.filename ?? "");
      if (!byCanonical.has(key)) byCanonical.set(key, []);
      byCanonical.get(key)!.push(r);
    }

    const counts = { upgrade: 0, "rename-only": 0, keep: 0, create: 0, dupe: 0, orphan: 0 };
    const details: string[] = [];
    let bytesToUpload = 0;
    const matchedIds = new Set<string>();
    const dupeIds = new Set<string>();

    for (const name of entries.sort()) {
      const filePath = path.join(dir, name);
      const key = stem(name);
      const candidates = byCanonical.get(key) ?? [];

      if (candidates.length === 0) {
        counts.create++;
        bytesToUpload += (await stat(filePath)).size;
        details.push(`create      ${name} (no stored row for this name)`);
        continue;
      }

      const row = candidates[0];
      matchedIds.add(row.id);
      for (const extra of candidates.slice(1)) {
        counts.dupe++;
        dupeIds.add(extra.id);
        details.push(`dupe        ${extra.filename} (id ${extra.id.slice(0, 8)}, orderIndex ${extra.orderIndex}) — delete`);
      }

      const isPng = (row.mime ?? "").toLowerCase().includes("png") || /\.png$/i.test(row.filename ?? "");
      if (isPng) {
        counts.upgrade++;
        bytesToUpload += (await stat(filePath)).size;
      } else if ((row.filename ?? "") !== name) {
        counts["rename-only"]++;
        details.push(`rename-only ${row.filename} → ${name}`);
      } else {
        counts.keep++;
      }
    }

    for (const r of folderRows) {
      if (matchedIds.has(r.id) || dupeIds.has(r.id)) continue;
      counts.orphan++;
      details.push(`orphan      ${r.filename} (id ${r.id.slice(0, 8)}, ${r.mime}, ${mb(r.size ?? 0)}) — no file on disk, not touched`);
    }

    for (const k of Object.keys(counts) as (keyof typeof counts)[]) totals[k] += counts[k];
    totals.bytesToUpload += bytesToUpload;
    report.push({ local: localDir, slug, name: folders.find((f) => f.slug === slug)?.name ?? slug, counts, bytesToUpload, details });
  }

  console.log(`converted tree: ${JPG_ROOT}`);
  console.log(`folders mapped: ${MAP.length}   db visible folders: ${folders.filter((f) => !f.hidden).length}`);
  if (missingDirs.length) console.log(`MISSING DIRS:\n  ${missingDirs.join("\n  ")}`);
  if (uncovered.length) console.log(`DB FOLDERS NOT IN THE MAP:\n  ${uncovered.map((f) => `${f.name} (${f.slug})`).join("\n  ")}`);

  console.log("");
  for (const r of report) {
    const c = r.counts;
    console.log(
      `${r.slug.padEnd(22)} ${r.local.padEnd(18)} files ${String(c.upgrade + c["rename-only"] + c.keep + c.create).padStart(3)}` +
        ` | rows ${String(rowsByFolder.get(r.slug)?.length ?? 0).padStart(3)}` +
        ` | upgrade ${String(c.upgrade).padStart(3)} rename ${String(c["rename-only"]).padStart(2)} keep ${String(c.keep).padStart(2)}` +
        ` create ${String(c.create).padStart(2)} dupe ${String(c.dupe).padStart(2)} orphan ${String(c.orphan).padStart(2)}` +
        ` | upload ${mb(r.bytesToUpload)}`,
    );
  }

  // Rows in folders outside the map (the hidden ones: videos, test) never enter the loop above.
  const outside = rows.filter((r) => r.folder && !mapped.has(r.folder));
  if (outside.length) {
    console.log(`\nrows outside the map (untouched):`);
    for (const r of outside) console.log(`  ${r.folder}/${r.filename} (${r.mime}, ${mb(r.size ?? 0)})`);
  }

  console.log(`\nTOTALS: ${JSON.stringify(totals)}`);
  console.log(`bytes to upload: ${mb(totals.bytesToUpload)}`);
  console.log("\ndetail (only rows needing attention):");
  for (const r of report) {
    if (!r.details.length) continue;
    console.log(`  ${r.slug}:`);
    for (const d of r.details) console.log(`    ${d}`);
  }

  const jsonPath = process.argv.includes("--json") ? process.argv[process.argv.indexOf("--json") + 1] : null;
  if (jsonPath) {
    await writeFile(jsonPath, JSON.stringify({ report, totals }, null, 2));
    console.log(`\nwrote ${jsonPath}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("failed:", err);
  process.exit(1);
});
