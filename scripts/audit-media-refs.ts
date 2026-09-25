#!/usr/bin/env node
/**
 * Static media reference audit (read-only).
 *
 * Reports:
 *   - ORPHAN references: a page points at a media URL that no asset row holds (the class of bug
 *     where an asset was deleted or re-uploaded and pages kept the old URL)
 *   - assets that no page references (safe delete candidates / unused uploads)
 *   - optionally (`--check-r2`) orphan URLs that 404 in R2
 *
 * Usage:
 *   node scripts/audit-media-refs.ts
 *   node scripts/audit-media-refs.ts --check-r2
 *   node scripts/audit-media-refs.ts --json
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

async function headOk(url: string): Promise<number> {
  try {
    const res = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' } })
    return res.status
  } catch {
    return 0
  }
}

async function main() {
  const checkR2 = process.argv.includes('--check-r2')
  const asJson = process.argv.includes('--json')

  const { prisma } = await import('../src/lib/prisma.ts')
  const { extractUrlRefs, resolveAssetIdsByUrls } = await import('../src/lib/media-refs.ts')
  const { extractStaticAssetIds } = await import('../src/lib/gallery-utils.ts')

  const pages = await prisma.page.findMany({ select: { slug: true, sections: true }, orderBy: { slug: 'asc' } })
  const assets = await prisma.asset.findMany({ select: { id: true, filename: true, publicUrl: true, folder: true } })
  const knownUrls = new Set(assets.map((asset) => asset.publicUrl).filter(Boolean) as string[])

  const orphans: { page: string; path: string; url: string; status?: number }[] = []
  const referenced = new Set<string>()

  for (const page of pages) {
    const refs = extractUrlRefs(page.sections as any)
    const staticIds = extractStaticAssetIds((page.sections as any) ?? [])
    staticIds.forEach((id) => referenced.add(id))

    const resolved = await resolveAssetIdsByUrls(refs.map((ref) => ref.url))
    resolved.forEach((id) => referenced.add(id))

    for (const ref of refs) {
      const matched =
        knownUrls.has(ref.url) || knownUrls.has(ref.url.replace(/ /g, '%20')) || knownUrls.has(decodeURIComponent(ref.url))
      if (!matched) orphans.push({ page: page.slug, path: ref.path, url: ref.url })
    }
  }

  if (checkR2) {
    for (const orphan of orphans) {
      orphan.status = await headOk(orphan.url)
    }
  }

  const unused = assets.filter((asset) => !referenced.has(asset.id))

  const report = {
    pages: pages.length,
    assets: assets.length,
    orphanReferences: orphans.length,
    unusedAssets: unused.length,
    orphans,
    unused: unused.map((asset) => ({ id: asset.id, filename: asset.filename, folder: asset.folder })),
  }

  if (asJson) {
    console.log(JSON.stringify(report, null, 1))
  } else {
    console.log(`pages: ${report.pages} · assets: ${report.assets}`)
    console.log(`\nORPHAN REFERENCES (${orphans.length}) — page points at media that is not in the library:`)
    for (const orphan of orphans) {
      console.log(`  ${orphan.page} ${orphan.path} → ${orphan.url}${orphan.status ? ` [HTTP ${orphan.status}]` : ''}`)
    }
    console.log(`\nUNUSED ASSETS (${unused.length}) — in the library but not referenced by any page:`)
    for (const asset of unused) {
      console.log(`  ${asset.folder ?? '(no folder)'} · ${asset.filename ?? asset.id}`)
    }
  }

  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
