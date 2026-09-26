#!/usr/bin/env node
/**
 * Reconcile MediaUsage for every page.
 *
 * `reconcileMediaUsage` records two kinds of static reference:
 *   - asset IDs held by static galleries (`gallery.mode === "static"`)
 *   - URLs held by every other media section (hero, banner, video, services, contact,
 *     collection-index entityImages), resolved back to asset rows
 *
 * Rows are rebuilt per page, so this is idempotent and safe to re-run after bulk page edits or
 * if the table ever drifts.
 *
 * Usage:
 *   node scripts/reconcile-usage.ts
 *   node scripts/reconcile-usage.ts --verbose
 */
import { config } from 'dotenv'
config({ path: ['.env.local', '.env'] })

async function main() {
  const verbose = process.argv.includes('--verbose')
  const { prisma } = await import('../src/lib/prisma.ts')
  const { reconcileMediaUsage } = await import('../src/lib/media-refs.ts')

  const pages = await prisma.page.findMany({ select: { slug: true, sections: true }, orderBy: { slug: 'asc' } })

  let totalRefs = 0
  const rows: { page: string; assets: number }[] = []

  for (const page of pages) {
    const assetIds = await reconcileMediaUsage(page.slug, page.sections as any)
    totalRefs += assetIds.length
    rows.push({ page: page.slug, assets: assetIds.length })
  }

  console.log(
    JSON.stringify(
      {
        pages: pages.length,
        mediaUsageRows: totalRefs,
        perPage: rows,
        ...(verbose ? {} : { hint: 're-run with --verbose for per-page detail only' }),
      },
      null,
      verbose ? 1 : 0,
    ),
  )
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
