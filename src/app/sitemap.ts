import type { MetadataRoute } from "next";
import { getPrimaryCollectionRouteBase } from "@/lib/pages";
import { getVisibleFolders } from "@/lib/folders";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";

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
const SITE = SITE_URL;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [pageRows, routeBase, folders] = await Promise.all([
    prisma.page.findMany({ where: { type: "page" }, select: { slug: true, updatedAt: true } }),
    getPrimaryCollectionRouteBase(),
    getVisibleFolders(),
  ]);

  const staticPages: MetadataRoute.Sitemap = pageRows.map(({ slug, updatedAt }) => ({
    url: slug === "home" ? `${SITE}/` : `${SITE}/${slug}`,
    lastModified: updatedAt,
    changeFrequency: "monthly",
    priority: slug === "home" ? 1 : 0.8,
  }));

  // Each project entry declares its photos, so Google can discover them without crawling. Before
  // and after frames are part of the portfolio; the transition marker rows are not pictures.
  const imageRows = folders.length
    ? await prisma.asset.findMany({
        where: {
          folder: { in: folders.map((f) => f.slug) },
          publicUrl: { not: null },
          hidden: false,
          mime: { startsWith: "image/" },
          NOT: { mime: "image/x-transition" },
        },
        orderBy: [{ folder: "asc" }, { orderIndex: "asc" }],
        select: { folder: true, publicUrl: true },
      })
    : [];

  const imagesByFolder = new Map<string, string[]>();
  for (const row of imageRows) {
    if (!row.folder || !row.publicUrl) continue;
    const list = imagesByFolder.get(row.folder) ?? [];
    list.push(row.publicUrl);
    imagesByFolder.set(row.folder, list);
  }

  const detailPages: MetadataRoute.Sitemap = routeBase
    ? folders.map((folder) => ({
        url: `${SITE}${routeBase}/${folder.slug}`,
        lastModified: folder.updatedAt,
        changeFrequency: "monthly",
        priority: 0.6,
        images: imagesByFolder.get(folder.slug) ?? undefined,
      }))
    : [];

  return [...staticPages, ...detailPages];
}
