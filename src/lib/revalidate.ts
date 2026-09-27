import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "./prisma";
import type { PageSection } from "@/types/sections";

/**
 * Central cache-invalidation helpers.
 *
 * Two layers must be invalidated together:
 *   - the data layer: `unstable_cache` entries in `src/lib/*.ts`, keyed by tags
 *   - the HTML layer: the rendered route, keyed by path
 *
 * Every mutation route builds a plan with `revalidationPlan(...)` and applies it with
 * `applyRevalidationPlan(...)`, so the set of invalidated tags/paths is testable in isolation.
 */

export type RevalidationPlan = { tags: string[]; paths: string[] };

export type Mutation =
  | { kind: "asset:created" }
  | { kind: "asset:updated"; assetId: string; folderChanged: boolean }
  | { kind: "asset:deleted"; pageSlugs: string[] }
  | { kind: "asset:reordered"; folder: string | null }
  | { kind: "folder:created" }
  | { kind: "folder:updated"; slug: string; previousSlug?: string }
  | { kind: "folder:deleted"; slug: string }
  | { kind: "folders:reordered" }
  | { kind: "page:saved"; slug: string }
  | { kind: "page:deleted"; slug: string }
  | { kind: "tag:changed" };

/** Route for a page slug. `home` renders at `/`, never `/home`. */
export function pathForSlug(slug: string): string {
  return slug === "home" ? "/" : `/${slug}`;
}

/** Stable path for a collection detail page (`/projects/<folderSlug>`). */
export function pathForEntity(routeBase: string, slug: string): string {
  const base = routeBase.replace(/^\/+|\/+$/g, "");
  return `/${base}/${slug}`;
}

function merge(...plans: RevalidationPlan[]): RevalidationPlan {
  return {
    tags: [...new Set(plans.flatMap((p) => p.tags))],
    paths: [...new Set(plans.flatMap((p) => p.paths))],
  };
}

/** Add the collection-index pages (e.g. `/projects`, plus `home` when it embeds a reference index). */
function planForCollectionPages(slugs: string[]): RevalidationPlan {
  return {
    tags: slugs.map((slug) => `page:${slug}`),
    paths: slugs.map(pathForSlug),
  };
}

/** Pages whose sections reference the collection index (names, tags, covers, order). */
export function pagesReferencingCollections(): Promise<string[]> {
  return prisma.page
    .findMany({ select: { slug: true, sections: true } })
    .then((pages) =>
      pages
        .filter((p) =>
          ((p.sections as unknown as PageSection[]) ?? []).some((s) => s.type === "collection-index"),
        )
        .map((p) => p.slug),
    );
}

/** Pages whose sections contain a dynamic gallery — their rendered output depends on asset data. */
export function pagesWithDynamicGalleries(): Promise<string[]> {
  return prisma.page
    .findMany({ select: { slug: true, sections: true } })
    .then((pages) =>
      pages
        .filter((p) =>
          ((p.sections as unknown as PageSection[]) ?? []).some(
            (s) => s.type === "gallery" && (s as { mode?: string }).mode === "dynamic",
          ),
        )
        .map((p) => p.slug),
    );
}

/** Route bases of primary collection-index sections — detail pages live under these. */
async function collectionRouteBases(): Promise<{ routeBase: string; source: "folders" | "tags" }[]> {
  const pages = await prisma.page.findMany({ select: { sections: true } });
  const found: { routeBase: string; source: "folders" | "tags" }[] = [];
  for (const page of pages) {
    for (const section of (page.sections as any[]) ?? []) {
      if (section?.type === "collection-index" && (section.mode ?? "primary") === "primary") {
        const base = String(section.routeBase ?? "").replace(/^\/+/, "");
        if (base && !found.some((f) => f.routeBase === base)) {
          found.push({ routeBase: base, source: section.source ?? "folders" });
        }
      }
    }
  }
  return found;
}

/** Detail-page paths affected by a folder slug (uses each primary collection route base). */
async function detailPathsForFolders(slugs: string[]): Promise<string[]> {
  const bases = await collectionRouteBases();
  const paths: string[] = [];
  for (const { routeBase, source } of bases) {
    if (source !== "folders") continue;
    for (const slug of slugs) paths.push(pathForEntity(routeBase, slug));
  }
  return paths;
}

/** Build the full invalidation plan for a mutation. */
export async function revalidationPlan(mutation: Mutation): Promise<RevalidationPlan> {
  const collectionPages = await pagesReferencingCollections();
  const collections = () => planForCollectionPages(collectionPages);

  switch (mutation.kind) {
    case "asset:created":
    case "asset:reordered": {
      // New/removed images can change folder covers and dynamic gallery contents.
      const dynamicPages = await pagesWithDynamicGalleries();
      return merge(planForCollectionPages(dynamicPages), collections());
    }

    case "asset:updated": {
      if (mutation.folderChanged) {
        const dynamicPages = await pagesWithDynamicGalleries();
        return merge(planForCollectionPages(dynamicPages), collections());
      }
      // Rename / alt only: revalidate exactly the pages that display this asset.
      const rows = await prisma.mediaUsage.findMany({
        where: { assetId: mutation.assetId },
        select: { pageSlug: true },
      });
      return planForCollectionPages(rows.map((r) => r.pageSlug));
    }

    case "asset:deleted": {
      const dynamicPages = await pagesWithDynamicGalleries();
      return merge(planForCollectionPages(mutation.pageSlugs), planForCollectionPages(dynamicPages), collections());
    }

    case "folder:created":
    case "folder:updated":
    case "folder:deleted":
    case "folders:reordered": {
      const slugs = mutation.kind === "folder:updated" || mutation.kind === "folder:deleted" ? [mutation.slug] : [];
      const tags = ["folders", ...slugs.map((s) => `folder:${s}`)];
      const paths = ["/projects", "/sitemap.xml", ...(await detailPathsForFolders(slugs))];
      if (mutation.kind === "folder:updated" && mutation.previousSlug && mutation.previousSlug !== mutation.slug) {
        tags.push(`folder:${mutation.previousSlug}`);
        paths.push(...(await detailPathsForFolders([mutation.previousSlug])));
      }
      return merge({ tags, paths }, collections());
    }

    case "page:saved":
    case "page:deleted":
      // `/sitemap.xml` belongs here as well as in the folder branches: creating, renaming or deleting
      // a page changes the URL list, and without this it would only refresh when the 300s cache
      // window on the page reads expired.
      return merge(
        {
          tags: [`page:${mutation.slug}`, "global:nav", "global:pages"],
          paths: [pathForSlug(mutation.slug), "/", "/sitemap.xml"],
        },
        collections(),
      );

    case "tag:changed":
      return merge({ tags: ["tags"], paths: [] }, collections());

    default:
      return { tags: [], paths: [] };
  }
}

/** Execute a plan. Logs one line so prod behaviour is verifiable from the logs. */
export function applyRevalidationPlan(
  plan: RevalidationPlan,
  label?: string,
): RevalidationPlan {
  for (const tag of plan.tags) revalidateTag(tag, {});
  for (const path of plan.paths) revalidatePath(path);
  if (label) console.info(`[revalidate] ${label}`, JSON.stringify(plan));
  return plan;
}

/** Convenience: plan + apply in one call. */
export async function revalidateFor(mutation: Mutation, label?: string): Promise<RevalidationPlan> {
  return applyRevalidationPlan(await revalidationPlan(mutation), label ?? mutation.kind);
}
