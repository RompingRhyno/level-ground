/**
 * Move stored media URLs from the old R2 origin (r2.dev) to the bucket's custom domain.
 *
 * Three places hold literal URLs:
 *   - Asset.publicUrl            (one per asset)
 *   - Asset.meta                 (video poster + variants.{720p,1080p})
 *   - Page.sections              (curated section images / video URLs, stored as JSON)
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/rewrite-r2-base.ts --to https://assets.example.com
 *   npx tsx --env-file=.env.local scripts/rewrite-r2-base.ts --to https://assets.example.com --apply
 *
 * --from defaults to R2_BASE_URL, so run it before changing that variable. A dry run prints every
 * count; --apply first writes a backup of all affected rows to /tmp, then rewrites and re-counts.
 */
import { writeFileSync } from "node:fs";
import prisma from "../src/lib/prisma";

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const apply = args.includes("--apply");
const to = (flag("to") ?? "").replace(/\/$/, "");
const from = (flag("from") ?? (process.env.R2_BASE_URL ?? "")).replace(/\/$/, "");

if (!from || !to) {
  console.error("need --from (or R2_BASE_URL) and --to");
  process.exit(1);
}
if (from === to) {
  console.error("from and to are identical");
  process.exit(1);
}

const countIn = (text: string) => (text.match(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length;

(async () => {
  const assets = await prisma.asset.findMany({ select: { id: true, publicUrl: true, meta: true } });
  const pages = await prisma.page.findMany({ select: { id: true, slug: true, sections: true } });

  const publicUrls = assets.filter((a) => a.publicUrl?.startsWith(`${from}/`));
  const metas = assets.filter((a) => a.meta && countIn(JSON.stringify(a.meta)) > 0);
  const pagesHit = pages.filter((p) => countIn(JSON.stringify(p.sections ?? [])) > 0);
  const pageRefs = pagesHit.reduce((n, p) => n + countIn(JSON.stringify(p.sections ?? [])), 0);
  const metaRefs = metas.reduce((n, a) => n + countIn(JSON.stringify(a.meta)), 0);

  console.log(JSON.stringify({
    from, to, apply,
    assets: { publicUrl: publicUrls.length, meta: metas.length, metaRefs },
    pages: { affected: pagesHit.length, refs: pageRefs, slugs: pagesHit.map((p) => p.slug) },
  }, null, 1));

  if (!apply) {
    console.log("dry run — nothing written. Re-run with --apply.");
    await prisma.$disconnect();
    return;
  }

  const backupPath = `/tmp/r2-rewrite-backup-${Date.now()}.json`;
  writeFileSync(backupPath, JSON.stringify({
    from, to,
    assets: assets.filter((a) => publicUrls.some((p) => p.id === a.id) || metas.some((m) => m.id === a.id)),
    pages: pagesHit,
  }, null, 1));
  console.log(`backup: ${backupPath}`);

  // publicUrl: a plain string swap, done in SQL so it is one statement.
  const updated = await prisma.$executeRawUnsafe(
    `update "Asset" set "publicUrl" = replace("publicUrl", $1, $2) where "publicUrl" like $3`,
    from, to, `${from}/%`,
  );
  console.log(`Asset.publicUrl rows updated: ${updated}`);

  let metaUpdated = 0;
  for (const a of metas) {
    const next = JSON.parse(JSON.stringify(a.meta).split(from).join(to));
    await prisma.asset.update({ where: { id: a.id }, data: { meta: next } });
    metaUpdated++;
  }
  console.log(`Asset.meta rows updated: ${metaUpdated}`);

  let pageUpdated = 0;
  for (const p of pagesHit) {
    const next = JSON.parse(JSON.stringify(p.sections ?? []).split(from).join(to));
    await prisma.page.update({ where: { id: p.id }, data: { sections: next } });
    pageUpdated++;
  }
  console.log(`Page.sections rows updated: ${pageUpdated}`);

  // Re-read and confirm nothing is left on the old origin.
  const afterAssets = await prisma.asset.findMany({ select: { publicUrl: true, meta: true } });
  const afterPages = await prisma.page.findMany({ select: { sections: true } });
  const leftover =
    afterAssets.filter((a) => (a.publicUrl ?? "").includes(from)).length +
    afterAssets.filter((a) => a.meta && JSON.stringify(a.meta).includes(from)).length +
    afterPages.filter((p) => JSON.stringify(p.sections ?? []).includes(from)).length;
  const onNew =
    afterAssets.filter((a) => (a.publicUrl ?? "").startsWith(to)).length +
    afterAssets.filter((a) => a.meta && JSON.stringify(a.meta).includes(to)).length +
    afterPages.filter((p) => JSON.stringify(p.sections ?? []).includes(to)).length;

  console.log(JSON.stringify({ leftover, onNewOrigin: onNew }, null, 1));
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error("ERR", e);
  await prisma.$disconnect();
  process.exit(1);
});
