import type { MetadataRoute } from "next";

/**
 * Crawlers: index the public site, keep out of the admin surfaces, and point at the sitemap.
 * `/preview` is the page-editor preview and renders unpublished sections, so it stays out too.
 */
const SITE = (process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api", "/preview"],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
