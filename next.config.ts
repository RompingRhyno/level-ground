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

/**
 * Publish hosts that still appear in stored media URLs. The media library moved to a new account and
 * bucket, but page sections and asset rows hold absolute URLs to the previous bucket (no bulk copy is
 * planned — see docs/handoff.md), so the optimizer must accept both hosts. An unlisted host is what turns
 * a legacy URL into a broken image instead of a proxied one, while raw <video> tags keep working because
 * they never touch the optimizer.
 *
 * Delete an entry once no Page or Asset row references that host — `scripts/audit-media-refs.ts` and the
 * publish-base scan in the handoff notes are how to check.
 */
const legacyR2Hosts = ["pub-51a88a9bbfa0442cb46e460b42d35021.r2.dev"];

for (const hostname of legacyR2Hosts) {
  remotePatterns.push({ protocol: "https", hostname, pathname: "/**" });
}

remotePatterns.push({
  protocol: "https",
  hostname: "*.r2.cloudflarestorage.com",
  pathname: "/**",
});

const nextConfig: NextConfig = {
  images: {
    remotePatterns,
  },
};

export default nextConfig;