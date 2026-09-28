/**
 * Migration steps 7–8 — delete what the migration replaced.
 *
 *   npx tsx scripts/media-migration-cleanup.ts                 # plan only, deletes nothing
 *   npx tsx scripts/media-migration-cleanup.ts --apply
 *   npx tsx scripts/media-migration-cleanup.ts --apply --backup <path>   # default: newest backup
 *
 * Step 7: the pre-migration objects of every row whose storage key changed (the old PNGs). Keys come from the
 * backup taken before the upload, then are filtered against every key the database currently considers live —
 * the row's current key plus every rendition/poster recovered from metadata — so a key is only deleted when
 * nothing points at it.
 *
 * Step 8: duplicate rows (an extra row for the same folder + name — the retry-after-failure signature) and
 * their objects. Per folder the lowest `orderIndex` is the original and is kept, which is what the signed-off
 * dry-run report identified; a duplicate that MediaUsage or a page still references is skipped and reported,
 * never deleted, because asset ids are what galleries store.
 *
 * Recoverable: the old masters live in `LGL Full` on disk, and the backup JSON holds every pre-migration row.
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { MAP, canonicalStem, mb, type Row } from "./media-migration-map";
import { r2KeysFromMeta } from "../src/lib/r2";

const APPLY = process.argv.includes("--apply");
const BACKUP_DIR = path.join(os.homedir(), "lg-migration-backups");

let s3: S3Client | undefined;
const getS3 = () =>
  (s3 ??= new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
    },
  }));

const bucket = () => process.env.R2_BUCKET_NAME as string;

/**
 * Keys the database considers live. `meta.mediaMigration` is stripped first: it names the key the migration
 * replaced (`fromKey`), and feeding that to the key recovery would mark every replaced object as still-live
 * and silently delete nothing.
 */
function liveKeysOf(row: Row, into: Set<string>) {
  into.add(row.storageKey);
  const meta = { ...((row.meta as Record<string, unknown>) ?? {}) };
  delete meta.mediaMigration;
  for (const k of r2KeysFromMeta(meta)) into.add(k);
}

async function latestBackup(): Promise<string> {
  const explicit = process.argv.includes("--backup") ? process.argv[process.argv.indexOf("--backup") + 1] : null;
  if (explicit) return explicit;
  const entries = (await readdir(BACKUP_DIR)).filter((f) => f.endsWith("-media-migration.json")).sort();
  if (!entries.length) throw new Error(`no backup found in ${BACKUP_DIR}`);
  return path.join(BACKUP_DIR, entries[entries.length - 1]);
}

async function main() {
  const prisma = (await import("../src/lib/prisma")).default;

  const backupPath = await latestBackup();
  const backup = JSON.parse(await readFile(backupPath, "utf8")) as {
    stamp: string;
    rows: Row[];
    pages: { slug: string; sections: unknown }[];
  };
  console.log(`backup: ${backupPath}  (${backup.rows.length} rows, ${backup.pages.length} pages)`);

  const liveRows: Row[] = await prisma.asset.findMany();
  const liveById = new Map(liveRows.map((r) => [r.id, r]));

  // Rows whose stored object the migration replaced: same id, different key.
  const upgrades = backup.rows.filter((r) => {
    const live = liveById.get(r.id);
    return live && live.storageKey !== r.storageKey;
  });
  const supersededUrls = new Set(upgrades.map((r) => r.publicUrl).filter((u): u is string => Boolean(u)));

  // These uploads recorded the original object inside `meta.variants` (an image's "1080p" slot is its source
  // URL), so a row that no longer *points* at the replaced object still *names* it. Those pointers are
  // rewritten to the new object first — otherwise the row keeps advertising a URL whose object step 7 deletes,
  // and the live-key safety check (correctly) treats the old key as still in use and deletes nothing.
  const metaRewrites: { id: string; filename: string | null; count: number }[] = [];
  for (const r of upgrades) {
    const live = liveById.get(r.id)!;
    if (!r.publicUrl || !live.publicUrl) continue;
    let count = 0;
    const rewrite = (node: unknown): unknown => {
      if (typeof node === "string") {
        if (node === r.publicUrl) {
          count++;
          return live.publicUrl;
        }
        return node;
      }
      if (Array.isArray(node)) return node.map(rewrite);
      if (node && typeof node === "object") {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(node as Record<string, unknown>)) out[k] = rewrite(v);
        return out;
      }
      return node;
    };
    const meta = rewrite(r.meta ?? {}) as object;
    if (count) {
      metaRewrites.push({ id: r.id, filename: r.filename, count });
      if (APPLY) await prisma.asset.update({ where: { id: r.id }, data: { meta } });
    }
  }
  console.log(`meta pointers at replaced objects: ${metaRewrites.length} row(s)${APPLY ? " — rewritten" : " (dry run: would be rewritten)"}`);

  // Keys the database considers live: every current storage key plus rendition/poster keys recovered from
  // metadata. URLs the migration superseded are skipped — in an --apply run they have just been rewritten, and
  // in a dry run they must not masquerade as live references or the plan would read as "nothing to delete".
  const liveKeys = new Set<string>();
  for (const r of liveRows) liveKeys.add(r.storageKey);
  for (const r of liveRows) {
    const meta = { ...((r.meta as Record<string, unknown>) ?? {}) };
    delete meta.mediaMigration;
    const collect = (node: unknown) => {
      if (typeof node === "string") {
        if (supersededUrls.has(node)) return;
        for (const k of r2KeysFromMeta({ v: node })) liveKeys.add(k);
        return;
      }
      if (Array.isArray(node)) return node.forEach(collect);
      if (node && typeof node === "object") for (const v of Object.values(node)) collect(v);
    };
    collect(meta);
  }

  // ── step 7: objects the migration replaced ──────────────────────────────────────────────────────────
  const replaced = upgrades
    .map((r) => ({ id: r.id, filename: r.filename, key: r.storageKey, size: r.size ?? 0 }))
    .filter((r) => !liveKeys.has(r.key));

  const replacedBytes = replaced.reduce((a, r) => a + r.size, 0);
  console.log(`\nstep 7 — replaced objects: ${replaced.length} (${mb(replacedBytes)})`);
  for (const r of replaced.slice(0, 3)) console.log(`  ${r.key}  (${mb(r.size)})`);
  if (replaced.length > 3) console.log(`  … and ${replaced.length - 3} more`);

  // ── step 8: duplicate rows ──────────────────────────────────────────────────────────────────────────
  const rowsByFolder = new Map<string, Row[]>();
  for (const r of liveRows) {
    if (!r.folder || !MAP.some(([, slug]) => slug === r.folder)) continue;
    if (!rowsByFolder.has(r.folder)) rowsByFolder.set(r.folder, []);
    rowsByFolder.get(r.folder)!.push(r);
  }
  const dupes: Row[] = [];
  for (const [slug, rows] of rowsByFolder) {
    // Order matters: the lowest orderIndex is the original the operator has been seeing, the higher one is
    // the retry. An unordered scan would pick either and could delete the row the pages actually point at.
    rows.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0) || a.id.localeCompare(b.id));
    const seen = new Set<string>();
    for (const r of rows) {
      const key = canonicalStem(slug, r.filename ?? "");
      if (seen.has(key)) dupes.push(r);
      else seen.add(key);
    }
  }

  const idIn = (node: unknown, id: string): boolean => {
    if (typeof node === "string") return node === id;
    if (Array.isArray(node)) return node.some((v) => idIn(v, id));
    if (node && typeof node === "object") return Object.values(node).some((v) => idIn(v, id));
    return false;
  };
  const usage: { assetId: string; pageSlug: string }[] = await prisma.mediaUsage.findMany({ select: { assetId: true, pageSlug: true } });

  const deletableDupes: Row[] = [];
  for (const dupe of dupes) {
    const usedBy = usage.filter((u) => u.assetId === dupe.id).map((u) => u.pageSlug);
    const inPages = backup.pages.filter((p) => idIn(p.sections, dupe.id)).map((p) => p.slug);
    const refs = [...new Set([...usedBy, ...inPages])];
    if (refs.length) {
      console.log(`\nstep 8 — SKIP ${dupe.folder}/${dupe.filename} (id ${dupe.id.slice(0, 8)}): referenced by ${refs.join(", ")}`);
      continue;
    }
    deletableDupes.push(dupe);
  }
  console.log(`\nstep 8 — duplicate rows to delete: ${deletableDupes.length}`);
  for (const d of deletableDupes) console.log(`  ${d.folder}/${d.filename} (id ${d.id.slice(0, 8)}, orderIndex ${d.orderIndex}, ${mb(d.size ?? 0)})`);

  if (!APPLY) {
    console.log(`\n(dry run — pass --apply to delete ${replaced.length} objects and ${deletableDupes.length} rows)`);
    await prisma.$disconnect();
    return;
  }

  // Record what is about to be deleted, before deleting it.
  const auditPath = path.join(BACKUP_DIR, `${backup.stamp}-cleanup.json`);
  await mkdir(BACKUP_DIR, { recursive: true });
  await writeFile(auditPath, JSON.stringify({ backupPath, replaced, dupes: deletableDupes }, null, 2));
  console.log(`\naudit: ${auditPath}`);

  let deletedObjects = 0;
  let failed = 0;
  for (const r of replaced) {
    try {
      await getS3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: r.key }));
      deletedObjects++;
      if (deletedObjects % 25 === 0) console.log(`  deleted ${deletedObjects}/${replaced.length}`);
    } catch (err) {
      failed++;
      console.error(`  FAILED ${r.key}: ${(err as Error).message}`);
    }
  }
  for (const d of deletableDupes) {
    // Same stripping as liveKeysOf: the audit field names a replaced key, not a live object.
    const meta = { ...((d.meta as Record<string, unknown>) ?? {}) };
    delete meta.mediaMigration;
    for (const key of [d.storageKey, ...r2KeysFromMeta(meta)]) {
      try {
        await getS3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
        deletedObjects++;
      } catch (err) {
        failed++;
        console.error(`  FAILED ${key}: ${(err as Error).message}`);
      }
    }
  }
  const rowResult = await prisma.asset.deleteMany({ where: { id: { in: deletableDupes.map((d) => d.id) } } });
  const usageResult = await prisma.mediaUsage.deleteMany({ where: { assetId: { in: deletableDupes.map((d) => d.id) } } });

  console.log(`\ndeleted ${deletedObjects} objects (${failed} failed), ${rowResult.count} duplicate rows, ${usageResult.count} usage rows`);
  console.log(`remaining assets: ${await prisma.asset.count()}`);
  console.log(`\nold masters stay on disk in LGL Full; run "npx tsx scripts/storage-usage.ts" to confirm the bucket size.`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("failed:", err);
  process.exit(1);
});
