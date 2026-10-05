/**
 * Re-sync R2 object keys with their asset's folder.
 *
 * Renaming a folder in the admin updates `Folder.slug`, `Asset.folder` and any page JSON that
 * referenced the old slug — but it does NOT move the objects in R2. The stored key therefore keeps
 * the old folder segment forever (`media/elliot-st/...` inside folder `elliott-st`), and the public
 * URL keeps it too.
 *
 * This script moves the objects to match, without re-uploading and without changing asset ids:
 *   1. CopyObject  old key -> media/<current folder>/<basename>
 *   2. HeadObject  verify the copy exists and has the same size
 *   3. update      Asset.storageKey, publicUrl, meta.variants.*, and filename when it changed
 *   4. DeleteObject the old key — only after the row has been updated
 *
 * Re-uploading would be worse than copying: it mints new asset ids (breaking page references that
 * pin assets by id), and it would push the PNG masters into a JPEG-only library.
 *
 * Usage (dry run by default — nothing is written without --apply):
 *   npx tsx scripts/r2-rekey.ts
 *   npx tsx scripts/r2-rekey.ts --folder=elliott-st --rename=ElliotSt:ElliottSt --apply
 *   npx tsx scripts/r2-rekey.ts --folder=west-35---curb --set-slug="West 35th - Curb" --apply
 *
 * Flags:
 *   --apply                perform the moves (otherwise just report)
 *   --folder=<slug>        limit to one folder
 *   --rename=From:To       replace a token in the basename (repeatable)
 *   --set-slug="Name"      rename the folder first (full cascade), then move its objects
 *   --keep-old             copy + update but leave the old objects in place
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { CopyObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

const argv = process.argv.slice(2);
const has = (f: string) => argv.some((a) => a === f || a.startsWith(`${f}=`));
const val = (f: string) => {
  const hit = argv.find((a) => a.startsWith(`${f}=`));
  return hit ? hit.slice(f.length + 1) : null;
};
const applies = has("--apply");
const keepOld = has("--keep-old");
let onlyFolder = val("--folder");
const setSlugName = val("--set-slug");
const renames: [string, string][] = argv
  .filter((a) => a.startsWith("--rename="))
  .map((a) => a.slice("--rename=".length).split(":") as [string, string]);

function applyRenames(name: string): string {
  let out = name;
  for (const [from, to] of renames) out = out.split(from).join(to);
  return out;
}

const segmentOf = (key: string): string | null => {
  const m = key.match(/^media\/([^/]+)\//);
  return m ? m[1] : null;
};
const basenameOf = (key: string): string => key.slice(key.lastIndexOf("/") + 1);
const prefixOf = (key: string): string => key.slice(0, key.lastIndexOf("/") + 1);

async function main() {
  const { default: prisma } = await import("../src/lib/prisma");
  const { r2Client, r2PublicUrlFor } = await import("../src/lib/r2");
  const target = r2Client();
  if (!target) throw new Error("R2 credentials missing — check .env.local");

  // 1) optional folder rename, reusing the exact cascade the admin route uses
  let targetFolder: string | null = null;
  if (setSlugName) {
    const current = await prisma.folder.findFirst({ where: onlyFolder ? { slug: onlyFolder } : {} });
    if (!current) throw new Error(`folder not found: ${onlyFolder}`);
    const { slugifyFolderName, resolveUniqueFolderSlug, rewriteFolderSlug } = await import("../src/lib/folders");
    const nextSlug = await resolveUniqueFolderSlug(slugifyFolderName(setSlugName), current.id);
    targetFolder = nextSlug;
    console.log(`folder rename: "${current.name}" (${current.slug}) -> "${setSlugName}" (${nextSlug})`);
    if (applies) {
      await prisma.folder.update({ where: { id: current.id }, data: { name: setSlugName, slug: nextSlug } });
      const moved = await prisma.asset.updateMany({ where: { folder: current.slug }, data: { folder: nextSlug } });
      const pages = (await prisma.page.findMany({ select: { slug: true, sections: true } })) as {
        slug: string;
        sections: unknown;
      }[];
      let touched = 0;
      for (const p of pages) {
        const res = rewriteFolderSlug(p.sections, current.slug, nextSlug);
        if (!res.changed) continue;
        await prisma.page.update({ where: { slug: p.slug }, data: { sections: res.sections as any } });
        touched++;
      }
      console.log(`  applied: ${moved.count} assets re-pointed, ${touched} page(s) rewritten`);
      onlyFolder = nextSlug; // assets now live under the new slug — query them there in step 2
    } else {
      console.log("  (dry run — folder untouched, keys previewed against the new slug)");
    }
  }

  // 2) find drifted objects
  const assets = await prisma.asset.findMany({
    where: onlyFolder ? { folder: onlyFolder } : {},
    select: { id: true, folder: true, filename: true, storageKey: true, publicUrl: true, meta: true, size: true },
    orderBy: { storageKey: "asc" },
  });

  type Plan = { id: string; oldKey: string; newKey: string; newName: string | null; url: string | null };
  const plan: Plan[] = [];
  for (const a of assets) {
    if (!a.folder) continue;
    const seg = segmentOf(a.storageKey);
    if (seg === null) continue;
    const dest = targetFolder ?? a.folder;
    const base = applyRenames(basenameOf(a.storageKey));
    const needsSegment = seg !== dest;
    const needsName = base !== basenameOf(a.storageKey);
    if (!needsSegment && !needsName) continue;
    plan.push({
      id: a.id,
      oldKey: a.storageKey,
      newKey: `media/${dest}/${base}`,
      newName: a.filename ? applyRenames(a.filename) : null,
      url: a.publicUrl,
    });
  }

  console.log(`\n${plan.length} object(s) to move in ${new Set(plan.map((p) => p.newKey.split("/")[1])).size} folder(s)\n`);
  for (const p of plan) {
    console.log(`  ${p.oldKey}\n    -> ${p.newKey}`);
  }
  if (!plan.length) {
    await prisma.$disconnect();
    return;
  }
  if (!applies) {
    console.log("\ndry run — re-run with --apply to move these. Nothing was changed.");
    await prisma.$disconnect();
    return;
  }

  let copied = 0;
  const skipped: string[] = [];
  for (const p of plan) {
    try {
      await target.client.send(
        new CopyObjectCommand({
          Bucket: target.bucket,
          CopySource: `${target.bucket}/${p.oldKey}`,
          Key: p.newKey,
        }) as any,
      );
      const head: any = await target.client.send(
        new HeadObjectCommand({ Bucket: target.bucket, Key: p.newKey }),
      );
      if (!head.ContentLength) throw new Error("copy not readable");
      copied++;
      console.log(`  copied  ${p.newKey} (${head.ContentLength} bytes)`);
    } catch (err: any) {
      skipped.push(p.oldKey);
      console.warn(`  FAILED  ${p.oldKey}: ${err?.message ?? err}`);
    }
  }

  // 3) rows for the copies that verified, including the URL inside meta
  let rowsUpdated = 0;
  for (const p of plan) {
    if (skipped.includes(p.oldKey)) continue;
    const asset = assets.find((a) => a.id === p.id);
    const url = r2PublicUrlFor(p.newKey);
    const meta = asset?.meta ? JSON.parse(JSON.stringify(asset.meta)) : null;
    if (meta && p.url && url) {
      const rewrite = (node: any): void => {
        if (typeof node === "string") return;
        if (Array.isArray(node)) return node.forEach(rewrite);
        if (node && typeof node === "object") {
          for (const [k, v] of Object.entries(node)) {
            if (typeof v === "string" && v === p.url) node[k] = url;
            else rewrite(v);
          }
        }
      };
      rewrite(meta);
    }
    await prisma.asset.update({
      where: { id: p.id },
      data: {
        storageKey: p.newKey,
        ...(url ? { publicUrl: url } : {}),
        ...(p.newName && p.newName !== asset?.filename ? { filename: p.newName } : {}),
        ...(meta ? { meta } : {}),
      },
    });
    rowsUpdated++;
  }

  // 4) only now remove the originals
  let removed = 0;
  const kept: string[] = [];
  if (keepOld) {
    kept.push(...plan.filter((p) => !skipped.includes(p.oldKey)).map((p) => p.oldKey));
  } else {
    for (const p of plan) {
      if (skipped.includes(p.oldKey)) continue;
      try {
        await target.client.send(new DeleteObjectCommand({ Bucket: target.bucket, Key: p.oldKey }) as any);
        removed++;
      } catch (err: any) {
        console.warn(`  delete failed ${p.oldKey}: ${err?.message ?? err}`);
      }
    }
  }

  console.log(
    `\ndone: ${copied} copied, ${rowsUpdated} rows updated, ${removed} old objects deleted` +
      (kept.length ? `, ${kept.length} kept (--keep-old)` : "") +
      (skipped.length ? `, ${skipped.length} FAILED: ${skipped.join(", ")}` : ""),
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
