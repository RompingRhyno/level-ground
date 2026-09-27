/**
 * TEMPORARY audit — how many stored values hard-code the current R2 publish domain?
 *
 * The DB stores absolute media URLs (page sections, asset variants/posters, folder covers), so moving
 * to a new bucket with a new r2.dev domain means rewriting them, not just copying objects. This scans
 * the three content models and reports where the old base appears.
 *
 * Read-only.
 *
 *   npx tsx scripts/tmp-r2-url-scan.ts
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const base = (process.env.R2_BASE_URL || "").replace(/\/$/, "");
  if (!base) throw new Error("R2_BASE_URL missing");
  const host = base.replace(/^https?:\/\//, "");

  const prisma = (await import("../src/lib/prisma")).default;

  const scan = (label: string, rows: { id: unknown; [k: string]: unknown }[]) => {
    let rowsWith = 0;
    let occurrences = 0;
    const samplePaths = new Set<string>();

    const walk = (node: unknown, path: string) => {
      if (typeof node === "string") {
        const hits = node.split(host).length - 1;
        if (hits > 0) {
          occurrences += hits;
          if (samplePaths.size < 12) samplePaths.add(path);
        }
        return;
      }
      if (Array.isArray(node)) {
        node.forEach((v, i) => walk(v, `${path}[${i}]`));
        return;
      }
      if (node && typeof node === "object") {
        for (const [k, v] of Object.entries(node as Record<string, unknown>)) walk(v, `${path}.${k}`);
      }
    };

    for (const row of rows) {
      const before = occurrences;
      walk(row, "row");
      if (occurrences > before) rowsWith++;
    }

    console.log(`\n${label}: ${rows.length} rows | ${rowsWith} contain the old base | ${occurrences} total occurrences`);
    if (samplePaths.size) console.log(`  field paths: ${[...samplePaths].join(", ")}`);
  };

  const [pages, assets, folders] = await Promise.all([
    prisma.page.findMany(),
    prisma.asset.findMany(),
    prisma.folder.findMany(),
  ]);

  scan("Page", pages as unknown as { id: unknown }[]);
  scan("Asset", assets as unknown as { id: unknown }[]);
  scan("Folder", folders as unknown as { id: unknown }[]);

  // Anything stored as a bare key rather than a URL also matters for the copy.
  const bareKeys = assets.filter((a) => !String((a as Record<string, unknown>).storageKey ?? "").startsWith("http"));
  console.log(`\nAsset.storageKey values that are bare keys (not URLs): ${bareKeys.length}/${assets.length}`);
  const legacyFlat = assets.filter((a) => {
    const k = String((a as Record<string, unknown>).storageKey ?? "");
    return k.length > 0 && !k.includes("/");
  });
  console.log(`Asset.storageKey values with no folder prefix (legacy flat layout): ${legacyFlat.length}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("scan failed:", err);
  process.exit(1);
});
