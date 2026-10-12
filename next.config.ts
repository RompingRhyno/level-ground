import type { NextConfig } from "next";
import {
  LEGACY_ARCHIVE_PREFIX,
  LEGACY_ARCHIVE_TERMS,
  LEGACY_PAGE_REDIRECTS,
  LEGACY_PROJECT_REDIRECTS,
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
  images: {
    remotePatterns,
    // Quality tiers: q75 stays the default (thumbnails/tiles), q85 for third-width cards, q90 for
    // half-width media, q95 for full-span and hero images. Next rejects an undeclared quality outright
    // (`"q" parameter (quality) of N is not allowed`), so every value a component passes must be listed
    // here — see docs/component-pass-plan.md.
    qualities: [75, 85, 90, 95],
    // Defaults plus 2560: a 1x QHD screen needs 2560 and would otherwise take the 3840 candidate (2.25x the
    // pixels, ~1.5x the width), and a 2x 1280 screen needs exactly 2560. The browser still picks the
    // smallest candidate that covers the slot, so no display ever gets a lower-resolution image than before.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 2560, 3840],
  },
};

export default nextConfig;