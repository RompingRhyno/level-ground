import prisma from "./prisma";

type ResolvedAsset = {
  id: string;
  url: string | null;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
};

// Simple in-memory cache for resolved URLs (small TTL semantics can be added)
const urlCache = new Map<string, { url: string; ts: number }>();

// Provider adapter interface - implementers should provide provider-specific logic
type ProviderAdapter = {
  buildPublicUrl?: (storageKey: string) => Promise<string> | string;
  download?: (storageKey: string) => Promise<Buffer>;
  upload?: (buffer: Buffer, opts: { filename?: string }) => Promise<{ storageKey: string; publicUrl: string }>;
};

// Minimal provider registry - extend with real adapters (Cloudflare, S3, etc.)
const providers: Record<string, ProviderAdapter> = {
  // Generic adapter that builds a URL from an env base + storageKey. Useful for simple object stores.
  generic: {
    buildPublicUrl: (storageKey: string) => {
      const base = process.env.ASSETS_BASE_URL || "";
      if (!base) throw new Error("ASSETS_BASE_URL not configured for generic provider");
      return `${base.replace(/\/$/, "")}/${storageKey}`;
    },
  },
};

async function healthCheckUrl(url: string): Promise<boolean> {
  try {
    // HEAD request — Node 18+ has global fetch
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch (err) {
    return false;
  }
}

export async function resolveAsset(assetId: string): Promise<ResolvedAsset | null> {
  if (!assetId) return null;

  // Check cache
  const cached = urlCache.get(assetId);
  if (cached && Date.now() - cached.ts < 1000 * 60 * 5) {
    return { id: assetId, url: cached.url };
  }

  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) return null;

  // Fast path: cached publicUrl in DB
  if (asset.publicUrl) {
    const ok = await healthCheckUrl(asset.publicUrl);
    if (ok) {
      urlCache.set(assetId, { url: asset.publicUrl, ts: Date.now() });
      return { id: assetId, url: asset.publicUrl, alt: asset.alt ?? null, width: asset.width ?? null, height: asset.height ?? null };
    }
  }

  // Try to build a URL via provider adapter
  const adapter = providers[asset.provider] || providers["generic"];
  if (adapter && adapter.buildPublicUrl) {
    try {
      const url = await adapter.buildPublicUrl(asset.storageKey);
      // Optional: health-check built url before updating DB
      const ok = await healthCheckUrl(url);
      if (ok) {
        await prisma.asset.update({ where: { id: assetId }, data: { publicUrl: url } });
        urlCache.set(assetId, { url, ts: Date.now() });
        return { id: assetId, url, alt: asset.alt ?? null, width: asset.width ?? null, height: asset.height ?? null };
      }
    } catch (err) {
      // ignore and fallthrough to fallback behavior
      console.error("provider buildPublicUrl failed", err);
    }
  }

  // Last resort: return whatever publicUrl exists (even if unhealthy), or null
  const fallback = asset.publicUrl ?? null;
  if (fallback) {
    urlCache.set(assetId, { url: fallback, ts: Date.now() });
  }
  return { id: assetId, url: fallback, alt: asset.alt ?? null, width: asset.width ?? null, height: asset.height ?? null };
}

// Simple helper to perform an upload via the configured provider.
// Real implementation should stream and avoid loading entire file into memory.
export async function uploadToProvider(providerName: string, buffer: Buffer, filename?: string) {
  const adapter = providers[providerName];
  if (!adapter || !adapter.upload) throw new Error(`upload not implemented for provider ${providerName}`);
  return adapter.upload(buffer, { filename });
}

export default {
  resolveAsset,
  uploadToProvider,
};
