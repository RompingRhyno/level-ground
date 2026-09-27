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

  // ── revalidation plan ──────────────────────────────────────────────────────
  // These hit the database (the plan resolves route bases and collection pages), so assertions are
  // properties rather than exact arrays: a mutation must invalidate *at least* the things it cannot
  // be correct without. The non-empty check is the guard that caught nothing for months — a mutation
  // kind whose plan silently returns `{ tags: [], paths: [] }` looks fine in every log line.
  console.log('revalidation plan')
  const { revalidationPlan } = await import('../src/lib/revalidate.ts')

  const folderCreated = await revalidationPlan({ kind: 'folder:created' })
  check(
    'folder:created busts the folder list, /projects and the sitemap',
    [
      folderCreated.tags.includes('folders'),
      folderCreated.paths.includes('/projects'),
      folderCreated.paths.includes('/sitemap.xml'),
    ],
    [true, true, true],
  )

  const renamed = await revalidationPlan({ kind: 'folder:updated', slug: 'new-slug', previousSlug: 'old-slug' })
  check(
    'folder rename busts both slugs (tags)',
    [renamed.tags.includes('folder:new-slug'), renamed.tags.includes('folder:old-slug')],
    [true, true],
  )
  check(
    'folder rename busts both detail paths',
    [renamed.paths.includes('/projects/new-slug'), renamed.paths.includes('/projects/old-slug')],
    [true, true],
  )

  const folderDeleted = await revalidationPlan({ kind: 'folder:deleted', slug: 'gone' })
  check(
    'folder:deleted busts its detail path and the sitemap',
    [folderDeleted.paths.includes('/projects/gone'), folderDeleted.paths.includes('/sitemap.xml')],
    [true, true],
  )

  for (const kind of ['page:saved', 'page:deleted'] as const) {
    const plan = await revalidationPlan({ kind, slug: 'about' })
    check(
      `${kind} busts the page, the nav and the sitemap`,
      [
        plan.paths.includes('/about'),
        plan.paths.includes('/'),
        plan.paths.includes('/sitemap.xml'),
        plan.tags.includes('page:about'),
      ],
      [true, true, true, true],
    )
  }

  const tagChanged = await revalidationPlan({ kind: 'tag:changed' })
  check('tag:changed busts the tag list', tagChanged.tags.includes('tags'), true)

  const mustInvalidateSomething: Parameters<typeof revalidationPlan>[0][] = [
    { kind: 'asset:created' },
    { kind: 'asset:deleted', pageSlugs: ['home'] },
    { kind: 'asset:reordered', folder: 'some-folder' },
    { kind: 'folder:created' },
    { kind: 'folders:reordered' },
    { kind: 'page:saved', slug: 'home' },
    { kind: 'page:deleted', slug: 'home' },
    { kind: 'tag:changed' },
  ]
  for (const mutation of mustInvalidateSomething) {
    const plan = await revalidationPlan(mutation as Parameters<typeof revalidationPlan>[0])
    check(`${mutation.kind} invalidates something`, plan.tags.length + plan.paths.length > 0, true)
  }

  console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
