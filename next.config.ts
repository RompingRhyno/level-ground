import type { NextConfig } from "next";

const r2Base = process.env.R2_BASE_URL;

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