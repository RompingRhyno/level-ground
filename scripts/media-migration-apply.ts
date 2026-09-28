/**
 * Migration steps 3–6 — upload the converted JPEGs, update the matched rows in place, sweep page JSON.
 *
 *   npx tsx scripts/media-migration-apply.ts                 # dry run: prints the plan, writes nothing
 *   npx tsx scripts/media-migration-apply.ts --apply         # upload + row updates + JSON sweep
 *   npx tsx scripts/media-migration-apply.ts --verify        # read-only checks after the run
 *
 * Properties this script is expected to hold:
 *   - Idempotent: a file whose row already points at a key derived from its current name is skipped, so a
 *     re-run after a failure only finishes what is missing.
 *   - Backed up: every row and page it will touch is dumped to ~/lg-migration-backups/ before the first
 *     write, in its pre-migration state.
 *   - Reversible until step 7: objects are uploaded under NEW keys, so the old ones keep serving every old
 *     URL until they are explicitly deleted.
 *   - Order-preserving: rows keep their id, folder and orderIndex; only the object pointer and metadata move.
 *
 * Plan and rationale: docs/media-migration-plan.md.
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import { PutObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { localFile, MAP, canonicalStem, stem, mb, type Row, type PlanEntry } from "./media-migration-map";
import { MEDIA_CACHE_CONTROL, storageKeyFor } from "../src/lib/mime";

const execFileAsync = promisify(execFile);
const APPLY = process.argv.includes("--apply");
const VERIFY = process.argv.includes("--verify");
const CONCURRENCY = 6;
const BACKUP_DIR = path.join(os.homedir(), "lg-migration-backups");

// Built lazily: module-level code runs before `config()` loads .env, so reading credentials here would
// capture undefined values. Everything env-dependent in this script is resolved inside main() or on first use.
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

const publicUrlFor = (key: string) => `${(process.env.R2_BASE_URL as string).replace(/\/$/, "")}/${key}`;

async function imageSize(file: string) {
  const { stdout } = await execFileAsync("magick", ["identify", "-format", "%w %h", file]);
  const [w, h] = stdout.trim().split(/\s+/).map(Number);
  return { width: w, height: h };
}

/** Match the converted tree against the database, exactly as the dry-run report did. */
async function buildPlan(prisma: any) {
  const rows: Row[] = await prisma.asset.findMany({
    where: { folder: { in: MAP.map(([, slug]) => slug) } },
    orderBy: [{ folder: "asc" }, { orderIndex: "asc" }],
  });
  const byFolder = new Map<string, Row[]>();
  for (const r of rows) {
    if (!r.folder) continue;
    if (!byFolder.has(r.folder)) byFolder.set(r.folder, []);
    byFolder.get(r.folder)!.push(r);
  }

  const { readdir } = await import("node:fs/promises");
  const plan: PlanEntry[] = [];
  for (const [localDir, slug] of MAP) {
    let entries: string[] = [];
    try {
      entries = (await readdir(path.join(/** dir */ localFile(localDir, "").replace(/\/$/, "")))).sort();
    } catch {
      continue;
    }
    const folderRows = byFolder.get(slug) ?? [];
    const byCanonical = new Map<string, Row[]>();
    for (const r of folderRows) {
      const key = canonicalStem(slug, r.filename ?? "");
      if (!byCanonical.has(key)) byCanonical.set(key, []);
      byCanonical.get(key)!.push(r);
    }
    for (const name of entries) {
      const candidates = byCanonical.get(stem(name)) ?? [];
      if (candidates.length === 0) {
        plan.push({ localDir, slug, name, action: "create", dupes: [] });
        continue;
      }
      const [row, ...dupes] = candidates;
      const isPng = (row.mime ?? "").toLowerCase().includes("png") || /\.png$/i.test(row.filename ?? "");
      const action = isPng ? "upgrade" : (row.filename ?? "") !== name ? "rename-only" : "keep";
      plan.push({ localDir, slug, name, action, row, dupes });
    }
  }
  return plan;
}

async function upload(entry: PlanEntry, oldKey: string | null): Promise<{ key: string; url: string; size: number }> {
  const file = localFile(entry.localDir, entry.name);
  const body = await readFile(file);
  // Fresh key with a new timestamp: the URL changes, so neither the optimizer's cache nor any CDN can serve
  // a stale variant, and the old object keeps serving the old URL until it is deleted.
  const key = storageKeyFor(entry.slug, entry.name);
  if (key === oldKey) throw new Error(`refusing to reuse the existing key for ${entry.name}`);
  await getS3().send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME as string,
      Key: key,
      Body: body,
      ContentLength: body.length, // R2 needs a known length (a stream body without one fails)
      ContentType: "image/jpeg",
      CacheControl: MEDIA_CACHE_CONTROL,
    }),
  );
  const head = await getS3().send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET_NAME as string, Key: key }));
  if (head.ContentLength !== body.length) {
    throw new Error(`size mismatch after upload for ${entry.name}: ${head.ContentLength} != ${body.length}`);
  }
  return { key, url: publicUrlFor(key), size: body.length };
}

/** Run `worker` over items with bounded concurrency. */
async function pool<T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (true) {
        const i = next++;
        if (i >= items.length) return;
        results[i] = await worker(items[i], i);
      }
    }),
  );
  return results;
}

async function main() {
  const prisma = (await import("../src/lib/prisma")).default;
  const plan = await buildPlan(prisma);

  const counts = plan.reduce<Record<string, number>>((acc, e) => ((acc[e.action] = (acc[e.action] ?? 0) + 1), acc), {});
  const toUpload = plan.filter((e) => e.action === "upgrade" || e.action === "create");

  if (VERIFY) return verify(prisma, plan);

  console.log(`plan: ${JSON.stringify(counts)}`);
  console.log(`uploads: ${toUpload.length}, rename-only: ${plan.filter((e) => e.action === "rename-only").length}`);
  if (!APPLY) {
    console.log("\n(dry run — pass --apply to execute)");
    for (const e of toUpload.slice(0, 10)) console.log(`  would upload ${e.slug}/${e.name}`);
    await prisma.$disconnect();
    return;
  }

  // ── backup ────────────────────────────────────────────────────────────────────────────────────────────
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const pages = await prisma.page.findMany({ select: { slug: true, sections: true } });
  const affectedRows = plan.filter((e) => e.row).map((e) => e.row);
  const affectedDupes = plan.flatMap((e) => e.dupes);
  await mkdir(BACKUP_DIR, { recursive: true });
  const backupPath = path.join(BACKUP_DIR, `${stamp}-media-migration.json`);
  await writeFile(
    backupPath,
    JSON.stringify(
      { stamp, counts, rows: [...affectedRows, ...affectedDupes], pages },
      null,
      2,
    ),
  );
  console.log(`\nbackup: ${backupPath} (${affectedRows.length + affectedDupes.length} rows, ${pages.length} pages)`);

  // ── upload ────────────────────────────────────────────────────────────────────────────────────────────
  const started = Date.now();
  let bytes = 0;
  let done = 0;
  const uploads = await pool(toUpload, CONCURRENCY, async (entry) => {
    const result = await upload(entry, entry.row?.storageKey ?? null);
    bytes += result.size;
    done++;
    if (done % 25 === 0 || done === toUpload.length) {
      console.log(`  uploaded ${done}/${toUpload.length}  (${mb(bytes)})`);
    }
    return result;
  });
  console.log(`uploaded ${toUpload.length} objects, ${mb(bytes)} in ${((Date.now() - started) / 1000).toFixed(0)}s`);

  // ── row updates (sequential; each row keeps its id, folder and orderIndex) ─────────────────────────────
  let updated = 0;
  let renamed = 0;
  const urlMap = new Map<string, string>();
  for (let i = 0; i < toUpload.length; i++) {
    const entry = toUpload[i];
    const { key, url, size } = uploads[i];
    const meta = { ...((entry.row?.meta as Record<string, unknown>) ?? {}), mediaMigration: { at: stamp, fromKey: entry.row?.storageKey ?? null, fromBytes: entry.row?.size ?? null, toBytes: size } };
    if (entry.action === "upgrade" && entry.row) {
      if (entry.row.publicUrl) urlMap.set(entry.row.publicUrl, url);
      await prisma.asset.update({
        where: { id: entry.row.id },
        data: { storageKey: key, publicUrl: url, filename: entry.name, mime: "image/jpeg", size, meta },
      });
      updated++;
    } else {
      // create: no stored row — the new asset takes the slot its name earns (same rule as a fresh upload)
      const { lockFolderForOrdering, nameInsertionSlot } = await import("../src/lib/asset-order");
      const { width, height } = await imageSize(localFile(entry.localDir, entry.name));
      await prisma.$transaction(async (tx: any) => {
        await lockFolderForOrdering(tx, entry.slug);
        const { slot, tail } = await nameInsertionSlot(tx, entry.slug, entry.name);
        if (tail.length) {
          await tx.asset.updateMany({ where: { id: { in: tail.map((a: { id: string }) => a.id) } }, data: { orderIndex: null } });
          for (let j = 0; j < tail.length; j++) {
            await tx.asset.update({ where: { id: tail[j].id }, data: { orderIndex: slot + j + 2 } });
          }
        }
        await tx.asset.create({
          data: {
            storageKey: key,
            provider: "r2",
            folder: entry.slug,
            orderIndex: slot + 1,
            filename: entry.name,
            mime: "image/jpeg",
            size,
            width,
            height,
            publicUrl: url,
            meta,
          },
        });
      });
      updated++;
    }
  }
  for (const entry of plan.filter((e) => e.action === "rename-only" && e.row)) {
    await prisma.asset.update({ where: { id: entry.row!.id }, data: { filename: entry.name } });
    renamed++;
  }
  console.log(`rows updated in place: ${updated}, filename-only renames: ${renamed}`);

  // ── page JSON sweep ───────────────────────────────────────────────────────────────────────────────────
  let pagesChanged = 0;
  let replacements = 0;
  for (const page of pages) {
    let hits = 0;
    const rewrite = (node: unknown): unknown => {
      if (typeof node === "string") {
        const direct = urlMap.get(node);
        if (direct) {
          hits++;
          return direct;
        }
        const spaced = urlMap.get(decodeURIComponent(node));
        if (spaced && node.includes("%20")) {
          hits++;
          return spaced; // keep the stored spelling style; the new names have no spaces anyway
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
    const sections = rewrite(page.sections ?? []);
    if (hits > 0) {
      await prisma.page.update({ where: { slug: page.slug }, data: { sections: sections as object } });
      pagesChanged++;
      replacements += hits;
      console.log(`  swept ${page.slug}: ${hits} reference(s)`);
    }
  }
  console.log(`page JSON: ${replacements} reference(s) rewritten across ${pagesChanged} page(s)`);
  console.log(`\ndone. old objects are untouched — delete them only after verifying (plan step 7).`);

  await prisma.$disconnect();
}

/** Post-run checks. Read-only. */
async function verify(prisma: any, plan: PlanEntry[]) {
  const rows: Row[] = await prisma.asset.findMany({ where: { folder: { in: MAP.map(([, slug]) => slug) } } });
  const byId = new Map(rows.map((r) => [r.id, r]));

  let stillPng = 0;
  let missing = 0;
  const oldUrls = new Set<string>();
  for (const entry of plan) {
    if (!entry.row && entry.action !== "create") continue;
    if (entry.action === "create") {
      const created = rows.find((r) => r.filename === entry.name && r.folder === entry.slug);
      if (!created) missing++;
      continue;
    }
    const row = byId.get(entry.row!.id);
    if (!row) {
      missing++;
      continue;
    }
    if ((row.mime ?? "").includes("png")) stillPng++;
    if (entry.row!.publicUrl && row.publicUrl && entry.row!.publicUrl !== row.publicUrl) oldUrls.add(entry.row!.publicUrl);
  }
  console.log(`rows: ${rows.length}; still PNG: ${stillPng}; missing/unmatched: ${missing}`);

  const pages = await prisma.page.findMany({ select: { slug: true, sections: true } });
  let staleRefs = 0;
  const walk = (node: unknown) => {
    if (typeof node === "string") {
      if (oldUrls.has(node)) staleRefs++;
      return;
    }
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === "object") for (const v of Object.values(node)) walk(v);
  };
  for (const p of pages) walk(p.sections ?? []);
  console.log(`page references still pointing at a replaced (old) URL: ${staleRefs}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("failed:", err);
  process.exit(1);
});
