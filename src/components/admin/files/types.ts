export type FolderData = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  tags: string[];
  order: number;
  hidden: boolean;
  assetCount: number;
  coverUrl: string | null;
  /** Serialised as an ISO string over JSON, a Date when passed directly from the server. */
  createdAt?: string | Date;
};

export type AssetData = {
  id: string;
  filename: string | null;
  mime: string | null;
  size: number | null;
  width: number | null;
  height: number | null;
  publicUrl: string | null;
  folder: string | null;
  orderIndex: number | null;
  alt: string | null;
  /** Prisma JSON: may be null, an object, or anything JSON-serialisable. */
  meta?: unknown;
  usedOn?: string[];
  createdAt?: string | Date;
  updatedAt?: string | Date;
  storageKey?: string;
  provider?: string;
};

export type TagData = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
};

export type StorageInfo = {
  bytesUsed: number;
  freeTierBytes: number;
  percentUsed: number;
  assetCount: number;
  images?: { count: number; bytes: number };
  videos?: { count: number; bytes: number };
  other?: { count: number; bytes: number };
};

const VIDEO_EXT = /\.(mp4|webm|ogv|ogg|mov|m4v)$/i;

export function isVideoAsset(asset: { mime?: string | null; filename?: string | null }): boolean {
  if (asset.mime) return asset.mime.startsWith("video/");
  return VIDEO_EXT.test(asset.filename ?? "");
}

export function posterUrlOf(asset: { meta?: unknown }): string | null {
  const poster = (asset.meta as { poster?: unknown } | null)?.poster;
  return typeof poster === "string" && poster ? poster : null;
}

/** Best available still for a tile: the image itself, or a video's captured poster. */
export function tileThumb(asset: AssetData): string | null {
  if (!asset.publicUrl) return null;
  return isVideoAsset(asset) ? posterUrlOf(asset) : asset.publicUrl;
}

export function filenameStem(asset: AssetData): string {
  const raw = asset.filename ?? "";
  const idx = raw.lastIndexOf(".");
  return idx === -1 ? raw : raw.slice(0, idx);
}

export function filenameExt(asset: AssetData): string {
  const raw = asset.filename ?? "";
  const idx = raw.lastIndexOf(".");
  return idx === -1 ? "" : raw.slice(idx);
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, i);
  return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}
