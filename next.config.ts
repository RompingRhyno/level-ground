import type { NextConfig } from "next";
import {
  LEGACY_ARCHIVE_PREFIX,
  LEGACY_ARCHIVE_TERMS,
  LEGACY_PAGE_REDIRECTS,
  LEGACY_PROJECT_REDIRECTS,
  RENAMED_SLUG_REDIRECTS,
} from "./src/lib/legacy-redirects";
import { serviceAnchorHref } from "./src/lib/services";

const r2Base = process.env.R2_BASE_URL;

/**
 * The legacy WordPress URLs, one row per old path. Sources are listed with and without the trailing
 * slash because the old site's URLs carry one; Next matches the pathname, so both are needed.
 *
 * These only execute where this app is served, so they are dormant until the domain cutover — the
 * WordPress host keeps answering on its own until then (see docs/handoff.md).
 */
type LegacyRedirect = { source: string; destination: string; permanent: boolean };

function legacyRedirects(): LegacyRedirect[] {
  const rows: LegacyRedirect[] = [];

  const push = (oldPath: string, destination: string) => {
    // A few legacy slugs already match their new path (west-24th, west-35th) and /contact keeps its
    // path entirely — redirecting those to themselves would loop. Trailing-slash normalisation
    // handles the slash form on its own.
    if (oldPath.replace(/\/$/, "") === destination.replace(/\/$/, "")) return;
    rows.push({ source: oldPath, destination, permanent: true });
    if (!oldPath.endsWith("/")) rows.push({ source: `${oldPath}/`, destination, permanent: true });
  };

  for (const [oldPath, destination] of LEGACY_PAGE_REDIRECTS) push(oldPath, destination);
  for (const [oldPath, destination] of LEGACY_PROJECT_REDIRECTS) push(oldPath, destination);
  for (const [oldPath, destination] of RENAMED_SLUG_REDIRECTS) push(oldPath, destination);
  for (const [term, serviceSlug] of LEGACY_ARCHIVE_TERMS) {
    // Retired terms (null) land at the top of the installation page; the rest go to their section.
    push(`${LEGACY_ARCHIVE_PREFIX}/${term}`, serviceAnchorHref(serviceSlug) ?? "/landscape-design-installation");
  }

  return rows;
}

const remotePatterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [];

if (r2Base) {
  try {
    const host = new URL(r2Base).hostname;
    remotePatterns.push({
      protocol: "https",
      hostname: host,
      pathname: "/**",
    });
  } catch (e) {
    // ignore
  }
}

remotePatterns.push({
  protocol: "https",
  hostname: "*.r2.cloudflarestorage.com",
  pathname: "/**",
});

const nextConfig: NextConfig = {
  async redirects() {
    return legacyRedirects();
  },
  async headers() {
    return [
      {
        // HSTS. Two years, subdomains included — the old site served plain http for a hop and none of
        // its redirects were secure-first; this closes that class of downgrade at the new host.
        // (Preload is deliberately not requested here; that needs a separate submission.)
        source: "/(.*)",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
  images: {
    remotePatterns,
    // Quality tiers: q75 for admin thumbnails, q90 for every public content surface (grid, bento,
    // masonry, lightbox), q95 only for the full-bleed one-offs (hero, banner, two-column). A photo that
    // appears on two surfaces must use one tier, or the optimizer caches it twice. Next rejects an
    // undeclared quality outright (`"q" parameter (quality) of N is not allowed`), so every value a
    // component passes must be listed here — see docs/component-pass-plan.md.
    qualities: [75, 90, 95],
    // Defaults plus 2560, minus 750: 2560 covers a 1x QHD screen (otherwise it takes the 3840 candidate) and
    // a 2x 1280 screen exactly; 750 is only 10% off 828 and is never the best candidate. The browser picks
    // the smallest candidate that covers the slot, so no display gets a lower-resolution image than before.
    deviceSizes: [640, 828, 1080, 1200, 1920, 2048, 2560, 3840],
    // Fixed-size slots (thumbnails/tiles) only: the merged candidate list otherwise carries 16–96px
    // entries into full-width images' srcsets. 128 keeps the admin's 56–128px tiles sharp at 2x.
    imageSizes: [128, 256, 384],
  },
};

export default nextConfig;