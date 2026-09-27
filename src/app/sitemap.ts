import type { MetadataRoute } from "next";
import { getAllPageSlugs, getPrimaryCollectionRouteBase } from "@/lib/pages";
import { getVisibleFolders } from "@/lib/folders";

/**
 * Sitemap, generated from the database on every request.
 *
 * Nothing to maintain by hand: static pages come from the `Page` table and collection detail pages
 * from the *visible* folders, so a folder you upload or unhide, or a page you create in the editor,
 * appears here on its own. Cache invalidation helps twice over — folder and page mutations already
 * bust `/sitemap.xml` through `revalidationPlan()`, and the reads behind this carry a 5-minute
 * window, so a stale entry cannot outlive that.
 *
 * Hidden folders are excluded (they 404 by design), as are templates and the admin routes.
 */
const SITE = (process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [pageSlugs, routeBase, folders] = await Promise.all([
    getAllPageSlugs(),
    getPrimaryCollectionRouteBase(),
    getVisibleFolders(),
  ]);

  const staticPages: MetadataRoute.Sitemap = pageSlugs.map((slug) => ({
    url: slug === "home" ? `${SITE}/` : `${SITE}/${slug}`,
    changeFrequency: "monthly",
    priority: slug === "home" ? 1 : 0.8,
  }));

  const detailPages: MetadataRoute.Sitemap = routeBase
    ? folders.map((folder) => ({
        url: `${SITE}${routeBase}/${folder.slug}`,
        changeFrequency: "monthly",
        priority: 0.6,
      }))
    : [];

  return [...staticPages, ...detailPages];
}
