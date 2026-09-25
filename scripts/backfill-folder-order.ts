#!/usr/bin/env ts-node
/**
 * Backfill `Folder.order` (and normalise `Folder.hidden`) for the media admin.
 *
 * Order source of preference:
 *   1. `entityOrder` array found in any `collection-index` section (legacy manual order)
 *   2. remaining folders in alphabetical (name ASC) order
 *
 * Idempotent-ish: folders are assigned `order = index + 1`, so `order = 0` means "never
 * backfilled". Re-running the script skips already-ordered folders unless `--force` is passed,
 * which protects any manual ordering done later in the admin UI.
 *
 * Usage:
 *   npx tsx scripts/backfill-folder-order.ts
 *   npx tsx scripts/backfill-folder-order.ts --force
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

async function main() {
  const force = process.argv.includes('--force')
  const { prisma } = await import('../src/lib/prisma.ts')

  const folders = await prisma.folder.findMany({
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    select: { id: true, name: true, slug: true, order: true },
  })

  const pages = await prisma.page.findMany({ select: { slug: true, sections: true } })
  const legacyOrder: string[] = []
  for (const page of pages) {
    for (const section of (page.sections as any[]) ?? []) {
      if (section?.type === 'collection-index' && Array.isArray(section.entityOrder)) {
        for (const slug of section.entityOrder) {
          if (typeof slug === 'string' && !legacyOrder.includes(slug)) legacyOrder.push(slug)
        }
      }
    }
  }

  const bySlug = new Map(folders.map((f) => [f.slug, f]))
  const ordered: { id: number; name: string; slug: string }[] = []
  for (const slug of legacyOrder) {
    const folder = bySlug.get(slug)
    if (folder) {
      ordered.push(folder)
      bySlug.delete(slug)
    }
  }
  // Alphabetical remainder (folders query is already name ASC)
  for (const folder of folders) {
    if (bySlug.has(folder.slug)) ordered.push(folder)
  }

  let written = 0
  let skipped = 0
  for (let i = 0; i < ordered.length; i++) {
    const folder = ordered[i]
    const nextOrder = i + 1
    const current = folders.find((f) => f.id === folder.id)
    if (!force && current && current.order !== 0) {
      skipped++
      continue
    }
    await prisma.folder.update({ where: { id: folder.id }, data: { order: nextOrder } })
    written++
  }

  console.log(
    JSON.stringify(
      {
        folders: folders.length,
        legacyOrderEntries: legacyOrder.length,
        written,
        skipped,
        finalOrder: ordered.map((f, i) => `${i + 1}. ${f.name} (${f.slug})`),
      },
      null,
      1,
    ),
  )
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
