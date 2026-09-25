import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAllowedUploadMime, isClientConvertedMime } from "@/lib/mime";
import { usageForAssets } from "@/lib/media-refs";
import { revalidateFor } from "@/lib/revalidate";

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

function clampInt(value: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

/**
 * Asset listing.
 *
 * Additive options (legacy behaviour preserved when none are passed):
 *   folder=<slug>          assets in a folder
 *   folder=__none__        assets with no folder
 *   tag=<slug>             assets in folders carrying the tag
 *   q=<text>               filename contains (case-insensitive)
 *   kind=image|video|other mime grouping
 *   sort=created_asc|created_desc|name_asc|order_asc
 *   limit / offset         paging
 *   include=usage          attach `usedOn` (page slugs) per asset
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const folder = url.searchParams.get("folder");
  const tag = url.searchParams.get("tag");
  const q = url.searchParams.get("q")?.trim();
  const kind = url.searchParams.get("kind");
  const sort = url.searchParams.get("sort") ?? "created_desc";
  const limit = clampInt(url.searchParams.get("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT);
  const offsetParam = Number(url.searchParams.get("offset"));
  const offset = Number.isFinite(offsetParam) ? Math.max(0, Math.trunc(offsetParam)) : 0;
  const includeUsage = url.searchParams.get("include") === "usage";

  const where: any = {};

  if (folder === "__none__") {
    where.folder = null;
  } else if (folder) {
    where.folder = folder;
  }

  if (tag) {
    const taggedFolders = await prisma.folder.findMany({
      where: { tags: { has: tag } },
      select: { slug: true },
    });
    where.folder = { in: taggedFolders.map((f) => f.slug) };
  }

  if (q) where.filename = { contains: q, mode: "insensitive" };

  if (kind === "image") where.mime = { startsWith: "image/" };
  else if (kind === "video") where.mime = { startsWith: "video/" };
  else if (kind === "other") {
    where.NOT = [{ mime: { startsWith: "image/" } }, { mime: { startsWith: "video/" } }];
  }

  const orderBy = (() => {
    switch (sort) {
      case "created_asc":
        return [{ createdAt: "asc" as const }];
      case "name_asc":
        return [{ filename: "asc" as const }];
      case "order_asc":
        return [{ orderIndex: "asc" as const }, { createdAt: "asc" as const }];
      default:
        return folder
          ? [{ orderIndex: "asc" as const }, { createdAt: "asc" as const }]
          : [{ createdAt: "desc" as const }];
    }
  })();

  const rows = await prisma.asset.findMany({ where, orderBy: orderBy as any, take: limit, offset });

  if (!includeUsage) return NextResponse.json(rows);

  const usage = await usageForAssets(rows.map((r) => r.id));
  return NextResponse.json(rows.map((row) => ({ ...row, usedOn: usage[row.id] ?? [] })));
}

/** Register an uploaded object as an asset. The folder is required. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { key, filename, mime, size, folder, publicUrl, alt, width, height, meta } = body ?? {};

    if (!key) return NextResponse.json({ error: "missing key" }, { status: 400 });
    if (!filename) return NextResponse.json({ error: "missing filename" }, { status: 400 });

    const folderSlug = typeof folder === "string" ? folder.trim() : "";
    if (!folderSlug) {
      return NextResponse.json(
        { error: "FOLDER_REQUIRED", message: "Every file must belong to a folder." },
        { status: 400 },
      );
    }

    const folderRow = await prisma.folder.findUnique({ where: { slug: folderSlug }, select: { id: true } });
    if (!folderRow) {
      return NextResponse.json({ error: "UNKNOWN_FOLDER", message: `No folder with slug "${folderSlug}".` }, { status: 400 });
    }

    if (isClientConvertedMime(mime)) {
      return NextResponse.json(
        { error: "CONVERT_IN_BROWSER", message: "HEIC/HEIF must be converted to JPEG before upload." },
        { status: 400 },
      );
    }
    if (mime && !isAllowedUploadMime(mime)) {
      return NextResponse.json(
        { error: "UNSUPPORTED_MEDIA_TYPE", message: `${mime} is not an accepted media type.` },
        { status: 415 },
      );
    }

    const created = await prisma.$transaction(async (tx: any) => {
      const agg = await tx.asset.aggregate({
        where: { folder: folderSlug },
        _max: { orderIndex: true },
      });
      const orderIndex = (agg._max.orderIndex ?? 0) + 1;

      return tx.asset.create({
        data: {
          storageKey: key,
          provider: "r2",
          filename,
          mime: mime ?? null,
          size: typeof size === "number" ? size : null,
          width: typeof width === "number" ? width : null,
          height: typeof height === "number" ? height : null,
          folder: folderSlug,
          orderIndex,
          publicUrl: publicUrl ?? null,
          alt: alt ?? null,
          meta: { uploadedAt: new Date().toISOString(), ...(meta && typeof meta === "object" ? meta : {}) },
        },
      });
    });

    await revalidateFor({ kind: "asset:created" }, `asset:create:${created.id}`);

    return NextResponse.json(created);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
