#!/usr/bin/env node
/**
 * Assertions for the pure helpers behind the media admin. No test framework needed:
 * run with `npx tsx scripts/check-media-lib.ts` (exits non-zero on failure).
 *
 * Covers the logic that is easy to get subtly wrong and hard to see in the UI:
 *   - cover resolution (image first, then a video's poster, never an mp4 URL)
 *   - folder-slug rewriting inside page JSON (rename cascade)
 *   - static media reference extraction (allow-list, no route strings)
 *   - URL candidate matching for raw vs percent-encoded references
 */
import { config } from 'dotenv'

// Env must load before the helpers import lib/prisma (which needs a connection string at
// construction time), hence the dynamic imports inside main().
config({ path: '.env.local' })
config({ path: '.env' })

let failures = 0

function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) {
    console.log(`  ok   ${name}`)
  } else {
    failures++
    console.log(`  FAIL ${name}\n       expected: ${e}\n       actual:   ${a}`)
  }
}

async function main() {
  const { pickCover, rewriteFolderSlug, slugifyFolderName } = await import('../src/lib/folders.ts')
  const { extractUrlRefs, normaliseUrl, urlCandidates } = await import('../src/lib/media-refs.ts')

  console.log('cover resolution')
  check(
    'image wins over video',
    pickCover([
      { folder: 'a', publicUrl: 'https://cdn/v.mp4', mime: 'video/mp4', meta: { poster: 'https://cdn/v.jpg' } },
      { folder: 'a', publicUrl: 'https://cdn/i.jpg', mime: 'image/jpeg', meta: null },
    ]),
    'https://cdn/i.jpg',
  )
  check(
    'video poster is used when there is no image',
    pickCover([
      { folder: 'a', publicUrl: 'https://cdn/v.mp4', mime: 'video/mp4', meta: { poster: 'https://cdn/v.jpg' } },
    ]),
    'https://cdn/v.jpg',
  )
  check(
    'an mp4 is never a cover',
    pickCover([{ folder: 'a', publicUrl: 'https://cdn/v.mp4', mime: 'video/mp4', meta: null }]),
    null,
  )
  check(
    'missing poster falls through',
    pickCover([{ folder: 'a', publicUrl: null, mime: null, meta: null }]),
    null,
  )

  console.log('folder slug rewrite')
  const sections = [
    { type: 'gallery', mode: 'dynamic', filters: { folder: '2499-larch-st', tags: [] } },
    {
      type: 'collection-index',
      entityOrder: ['2499-larch-st', 'w-10th-ave'],
      entityImages: { '2499-larch-st': 'https://cdn/x.jpg' },
    },
    { type: 'hero', heading: 'untouched', image: 'https://cdn/hero.jpg' },
  ]
  check(
    'rewrites filters.folder, entityOrder and entityImages keys',
    rewriteFolderSlug(sections, '2499-larch-st', '2499-larch-street').sections,
    [
      { type: 'gallery', mode: 'dynamic', filters: { folder: '2499-larch-street', tags: [] } },
      {
        type: 'collection-index',
        entityOrder: ['2499-larch-street', 'w-10th-ave'],
        entityImages: { '2499-larch-street': 'https://cdn/x.jpg' },
      },
      { type: 'hero', heading: 'untouched', image: 'https://cdn/hero.jpg' },
    ],
  )
  check('reports whether anything changed', rewriteFolderSlug(sections, 'nope', 'other').changed, false)
  check('slugify matches the API', slugifyFolderName('2499 Larch St.'), '2499-larch-st')

  console.log('reference extraction')
  const refs = extractUrlRefs([
    { type: 'hero', image: 'https://cdn/hero.jpg', buttonHref: '/contact' },
    { type: 'video', videoUrl: 'https://cdn/clip with space.mp4' },
    { type: 'services', services: [{ image: '/services-installation.jpg' }, { image: 'https://cdn/s.jpg' }] },
    { type: 'gallery', mode: 'dynamic', filters: { folder: 'x' } },
    { type: 'collection-index', entityImages: { p: 'https://cdn/p.jpg' }, entityOrder: ['p'] },
    { type: 'twoColumn', image: '/rain-barrel.jpeg' },
  ] as any)
  check('extracts exactly the media URLs', refs.map((ref) => ref.path).sort(), [
    '[0].image',
    '[1].videoUrl',
    '[2].services[1].image',
    '[4].entityImages.p',
  ])
  check('ignores public/ relative paths and route strings', refs.some((ref) => ref.url.startsWith('/')), false)
  check('keeps the raw url for matching', refs[1].url, 'https://cdn/clip with space.mp4')

  console.log('url matching')
  check(
    'decodes percent-encoding',
    normaliseUrl('https://cdn/clip%20with%20space.mp4'),
    'https://cdn/clip with space.mp4',
  )
  check('offers raw and encoded candidates', urlCandidates('https://cdn/clip with space.mp4').sort(), [
    'https://cdn/clip with space.mp4',
    'https://cdn/clip%20with%20space.mp4',
  ].sort())

  console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
