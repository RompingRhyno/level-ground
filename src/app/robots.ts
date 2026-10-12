import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/**
 * Crawlers: index the public site, keep out of the admin surfaces, and point at the sitemap.
 * `/preview` is the page-editor preview and renders unpublished sections, so it stays out too.
 */
const SITE = SITE_URL;

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
