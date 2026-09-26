#!/usr/bin/env node
/**
 * Capture poster frames for existing video assets.
 *
 * Videos uploaded before the renditions/poster pipeline have no `meta.poster`, so folder cards
 * and asset tiles fall back to a document placeholder. This walks the library, grabs a frame at
 * ~1s with the local ffmpeg, uploads it next to the video in R2 and records the URL (plus
 * width/height when they are missing) on the asset.
 *
 * Usage:
 *   npx tsx scripts/backfill-posters.ts --dry-run
 *   npx tsx scripts/backfill-posters.ts
 *   npx tsx scripts/backfill-posters.ts --at 3        # capture 3s in instead of 1s
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function ffprobeSize(file: string): { width: number; height: number } | null {
  try {
    const out = execFileSync(
      'ffprobe',
      ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file],
      { encoding: 'utf8' },
    ).trim()
    const [width, height] = out.split(',').map((value) => Number(value))
    if (!Number.isFinite(width) || !Number.isFinite(height)) return null
    return { width, height }
  } catch {
    return null
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const atIndex = process.argv.indexOf('--at')
  const timestamp = atIndex > -1 ? String(Number(process.argv[atIndex + 1]) || 1) : '1'

  const { prisma } = await import('../src/lib/prisma.ts')
  const { r2Client, r2PublicUrlFor } = await import('../src/lib/r2.ts')
  const { PutObjectCommand } = await import('@aws-sdk/client-s3')

  const videos = await prisma.asset.findMany({
    where: { mime: { startsWith: 'video/' }, publicUrl: { not: null } },
    orderBy: { createdAt: 'asc' },
  })

  const pending = videos.filter((asset) => {
    const poster = (asset.meta as { poster?: unknown } | null)?.poster
    return !(typeof poster === 'string' && poster)
  })

  console.log(`${videos.length} video asset(s); ${pending.length} without a poster`)
  if (!pending.length) {
    await prisma.$disconnect()
    return
  }

  const target = r2Client()
  if (!target) {
    console.error('R2 credentials missing — cannot upload posters')
    process.exit(1)
  }

  const workDir = mkdtempSync(join(tmpdir(), 'lg-posters-'))
  const results: { asset: string; posterKey?: string; bytes?: number; width?: number; height?: number; skipped?: string }[] = []

  for (const asset of pending) {
    const label = asset.filename ?? asset.id
    const posterFile = join(workDir, `${asset.id}.jpg`)
    const videoFile = join(workDir, `${asset.id}.mp4`)
    try {
      const response = await fetch(asset.publicUrl as string)
      if (!response.ok) throw new Error(`download failed: HTTP ${response.status}`)
      const buffer = Buffer.from(await response.arrayBuffer())
      require('node:fs').writeFileSync(videoFile, buffer)

      execFileSync('ffmpeg', [
        '-v', 'error', '-y',
        '-ss', timestamp,
        '-i', videoFile,
        '-frames:v', '1',
        '-vf', "scale='min(1280,iw)':-2",
        '-q:v', '4',
        posterFile,
      ])

      const size = statSync(posterFile).size
      const dimensions = ffprobeSize(videoFile)

      const storageKey = asset.storageKey ?? ''
      const dir = storageKey.includes('/') ? storageKey.slice(0, storageKey.lastIndexOf('/')) : ''
      const base = (asset.filename ?? asset.id).replace(/\.[^.]+$/, '')
      const posterKey = `${dir ? `${dir}/` : ''}${base}-poster.jpg`
      const posterUrl = r2PublicUrlFor(posterKey)

      if (!dryRun) {
        await target.client.send(
          new PutObjectCommand({
            Bucket: target.bucket,
            Key: posterKey,
            Body: readFileSync(posterFile),
            ContentType: 'image/jpeg',
          }) as any,
        )

        await prisma.asset.update({
          where: { id: asset.id },
          data: {
            meta: {
              ...((asset.meta as object) ?? {}),
              poster: posterUrl,
              posterKey,
              ...(asset.width == null && dimensions ? { width: dimensions.width } : {}),
              ...(asset.height == null && dimensions ? { height: dimensions.height } : {}),
            },
            ...(asset.width == null && dimensions ? { width: dimensions.width } : {}),
            ...(asset.height == null && dimensions ? { height: dimensions.height } : {}),
          },
        })
      }

      results.push({ asset: label, posterKey, bytes: size, width: dimensions?.width, height: dimensions?.height })
    } catch (error: any) {
      results.push({ asset: label, skipped: error?.message || String(error) })
    } finally {
      rmSync(posterFile, { force: true })
      rmSync(videoFile, { force: true })
    }
  }

  rmSync(workDir, { recursive: true, force: true })

  console.log(JSON.stringify({ dryRun, capturedAt: `${timestamp}s`, results }, null, 1))
  console.log(
    '\nPosters are read by the admin immediately (uncached). For the public /projects cards, ' +
      'trigger a revalidation by touching any folder (rename, reorder or hide/unhide).',
  )
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
