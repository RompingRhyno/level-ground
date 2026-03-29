import prisma from "@/lib/prisma";

type ResolvedAsset = {
  id: string;
  url: string | null;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
};

// Simple in-memory cache
const urlCache = new Map<string, { url: string; ts: number }>();

type ProviderAdapter = {
  buildPublicUrl?: (storageKey: string) => Promise<string> | string;
  download?: (storageKey: string) => Promise<Buffer>;
  upload?: (buffer: Buffer, opts: { filename?: string }) => Promise<{ storageKey: string; publicUrl: string }>;
};

// Helper to get required public base URL
function getR2PublicBaseUrl(): string {
  const base =
    process.env.CF_R2_PUBLIC_BASE_URL ||
    process.env.R2_PUBLIC_BASE_URL;

  if (!base) {
    throw new Error(
      "R2 public base URL not configured. Set CF_R2_PUBLIC_BASE_URL or R2_PUBLIC_BASE_URL"
    );
  }

  return base.replace(/\/$/, "");
}

// Provider registry
const providers: Record<string, ProviderAdapter> = {
  generic: {
    buildPublicUrl: (storageKey: string) => {
      const base = process.env.ASSETS_BASE_URL;
      if (!base) throw new Error("ASSETS_BASE_URL not configured");
      return `${base.replace(/\/$/, "")}/${storageKey}`;
    },
  },

  r2: {
    buildPublicUrl: (storageKey: string) => {
      const base = getR2PublicBaseUrl();
      return `${base}/${storageKey}`;
    },

    upload: async (buffer: Buffer, opts: { filename?: string } = {}) => {
      const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");

      const accessKeyId =
        process.env.CF_R2_ACCESS_KEY_ID ||
        process.env.R2_ACCESS_KEY_ID;

      const secretAccessKey =
        process.env.CF_R2_SECRET_ACCESS_KEY ||
        process.env.R2_SECRET_ACCESS_KEY;

      const accountId =
        process.env.CF_R2_ACCOUNT_ID ||
        process.env.R2_ACCOUNT_ID;

      const bucket =
        process.env.CF_R2_BUCKET ||
        process.env.R2_BUCKET_NAME;

      if (!accessKeyId || !secretAccessKey || !accountId || !bucket) {
        throw new Error("R2 credentials not configured");
      }

      const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

      const client = new S3Client({
        region: "auto",
        endpoint,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });

      const key = `${Date.now()}-${opts.filename || "asset"}`;

      const cmd = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
      });

      await client.send(cmd as any);

      const base = getR2PublicBaseUrl();
      const publicUrl = `${base}/${key}`;

      return { storageKey: key, publicUrl };
    },
  },
};

async function healthCheckUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function resolveAsset(assetId: string): Promise<ResolvedAsset | null> {
  if (!assetId) return null;

  const cached = urlCache.get(assetId);
  if (cached && Date.now() - cached.ts < 1000 * 60 * 5) {
    return { id: assetId, url: cached.url };
  }

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
  });

  if (!asset) return null;

  // Fast path
  if (asset.publicUrl) {
    const ok = await healthCheckUrl(asset.publicUrl);
    if (ok) {
      urlCache.set(assetId, { url: asset.publicUrl, ts: Date.now() });
      return {
        id: assetId,
        url: asset.publicUrl,
        alt: asset.alt ?? null,
        width: asset.width ?? null,
        height: asset.height ?? null,
      };
    }
  }

  // Build via provider
  const adapter = providers[asset.provider] || providers["generic"];

  if (adapter?.buildPublicUrl) {
    try {
      const url = await adapter.buildPublicUrl(asset.storageKey);

      const ok = await healthCheckUrl(url);
      if (ok) {
        await prisma.asset.update({
          where: { id: assetId },
          data: { publicUrl: url },
        });

        urlCache.set(assetId, { url, ts: Date.now() });

        return {
          id: assetId,
          url,
          alt: asset.alt ?? null,
          width: asset.width ?? null,
          height: asset.height ?? null,
        };
      }
    } catch (err) {
      console.error("provider buildPublicUrl failed", err);
    }
  }

  const fallback = asset.publicUrl ?? null;

  if (fallback) {
    urlCache.set(assetId, { url: fallback, ts: Date.now() });
  }

  return {
    id: assetId,
    url: fallback,
    alt: asset.alt ?? null,
    width: asset.width ?? null,
    height: asset.height ?? null,
  };
}

export async function uploadToProvider(
  providerName: string,
  buffer: Buffer,
  filename?: string
) {
  const adapter = providers[providerName];

  if (!adapter?.upload) {
    throw new Error(`upload not implemented for provider ${providerName}`);
  }

  return adapter.upload(buffer, { filename });
}

export default {
  resolveAsset,
  uploadToProvider,
};