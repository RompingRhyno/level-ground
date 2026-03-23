#!/usr/bin/env node
/*
  Template migration script to copy assets from the current provider to a new provider.
  This template is intentionally conservative: it demonstrates the flow and should be adapted
  to your provider SDKs, concurrency limits, and authentication.

  Usage (local):
    - Configure env vars (DATABASE_URL, OLD_PROVIDER, NEW_PROVIDER, ASSETS_BASE_URL etc.)
    - Run: `node scripts/migrate-assets.ts` (or run via ts-node after installing dependencies)

  Important: This is a template. Implement provider adapters for download/upload.
*/

import prisma from "../src/lib/prisma";
import assetsLib from "../src/lib/assets";

const BATCH = 50;
const OLD_PROVIDER = process.env.OLD_PROVIDER || "generic";
const NEW_PROVIDER = process.env.NEW_PROVIDER || "generic";

async function migrateBatch(offset: number) {
  const rows = await prisma.asset.findMany({ skip: offset, take: BATCH });
  if (rows.length === 0) return false;

  for (const asset of rows) {
    try {
      console.log(`Migrating asset ${asset.id} (provider=${asset.provider})`);
      // TODO: implement provider-specific download/upload via adapters
      // This template assumes you implement `assetsLib.uploadToProvider(provider, buffer, filename)`
      // and a suitable download function (not yet provided in the scaffold).

      // Example (pseudocode):
      // const buffer = await oldAdapter.download(asset.storageKey);
      // const res = await assetsLib.uploadToProvider(NEW_PROVIDER, buffer, asset.filename);
      // await prisma.asset.update({ where: { id: asset.id }, data: { provider: NEW_PROVIDER, storageKey: res.storageKey, publicUrl: res.publicUrl, migrated: true } });

      console.log(`SKIPPED (template) ${asset.id}`);
    } catch (err) {
      console.error(`Failed migrating ${asset.id}`, err);
    }
  }

  return rows.length === BATCH;
}

async function main() {
  let offset = 0;
  while (true) {
    const more = await migrateBatch(offset);
    if (!more) break;
    offset += BATCH;
  }

  console.log("Migration template finished (no uploads performed). Update script with real adapters before running).");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
