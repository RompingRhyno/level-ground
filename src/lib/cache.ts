/**
 * Backstop window for the cached public reads (`unstable_cache` in folders/tags/pages).
 *
 * Freshness normally comes from tag invalidation — every mutation route builds a plan with
 * `revalidationPlan()` and applies it, so a hidden folder, renamed slug or edited page is picked up
 * immediately. Tags do nothing for a `next build` though: a build cannot invalidate anything, so a
 * prerender that finds a warm data-cache entry will bake it into the HTML. That is not theoretical —
 * `getVisibleFolders()` kept serving a pre-hide list (and `getFolderBySlug()` a stale `hidden: false`
 * row) into production builds until the entry happened to be replaced.
 *
 * A finite window bounds it: once the entry is older than this, the next render re-queries the
 * database. Keep it short enough that a wrong folder list cannot survive a coffee break, long enough
 * that a low-traffic site is not re-querying on every request. Values are cheap to change.
 */
export const CACHE_REVALIDATE_SECONDS = 300;
