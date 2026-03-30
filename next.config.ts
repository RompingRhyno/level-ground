import type { NextConfig } from "next";

// Allow images from configured R2 public base or common R2 patterns
const r2Base = process.env.R2_BASE_URL || process.env.CF_R2_PUBLIC_BASE_URL || process.env.R2_PUBLIC_BASE_URL || process.env.CF_R2_BASE_URL;
const remotePatterns = [] as Array<{ protocol: string; hostname: string; pathname?: string }>;
if (r2Base) {
  try {
    const host = new URL(r2Base).host;
    remotePatterns.push({ protocol: "https", hostname: host, pathname: "/**" });
  } catch (e) {
    // ignore parse errors
  }
}

// Fallback: allow the default Cloudflare R2 storage host pattern if needed (bucket.account.r2.cloudflarestorage.com)
// Note: this is a best-effort default and may not match all setups.
remotePatterns.push({ protocol: "https", hostname: "*.r2.cloudflarestorage.com", pathname: "/**" } as any);

const nextConfig: NextConfig = {
  images: {
    remotePatterns,
  },
};

export default nextConfig;
