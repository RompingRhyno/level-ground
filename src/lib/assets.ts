type ProviderAdapter = {
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
  r2: {
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
  uploadToProvider,
};