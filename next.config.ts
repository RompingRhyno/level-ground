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

/**
 * Development stays permissive about R2 hosts, production does not. `next dev` turns an unconfigured
 * image host into a hard runtime error, and the page editor has to open on pages that still hold old
 * URLs (its preview iframe renders the real sections) — without this, the stale reference blocks the very
 * editor needed to replace it. Production keeps the strict list, so an old-bucket image fails visibly
 * rather than quietly rendering from a bucket that is being retired.
 */
if (process.env.NODE_ENV === "development") {
  remotePatterns.push({ protocol: "https", hostname: "**.r2.dev", pathname: "/**" });
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns,
  },
};

export default nextConfig;