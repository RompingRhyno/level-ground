import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession, unauthorized } from "@/lib/api-auth";

/** Cloudflare R2 free tier: 10 GB-month of standard storage. */
const FREE_TIER_BYTES = 10 * 1024 * 1024 * 1024;

/**
 * Library storage usage, derived from `sum(Asset.size)`.
 * Exact for everything the admin uploaded (sizes are recorded post-conversion); it does not
 * include contact-form uploads, which live outside the asset library.
 */
export async function GET() {
  const session = await requireSession();
  if (!session) return unauthorized();

  try {
    const [agg, count, byKind] = await Promise.all([
      prisma.asset.aggregate({ _sum: { size: true } }),
      prisma.asset.count(),
      prisma.asset.groupBy({ by: ["mime"], _count: { _all: true }, _sum: { size: true } }),
    ]);

    const bytesUsed = agg._sum.size ?? 0;
    const images = byKind.filter((row) => (row.mime ?? "").startsWith("image/"));
    const videos = byKind.filter((row) => (row.mime ?? "").startsWith("video/"));
    const sum = (rows: typeof byKind) => rows.reduce((total, row) => total + (row._sum.size ?? 0), 0);
    const countOf = (rows: typeof byKind) => rows.reduce((total, row) => total + row._count._all, 0);

    return NextResponse.json({
      bytesUsed,
      freeTierBytes: FREE_TIER_BYTES,
      percentUsed: FREE_TIER_BYTES ? bytesUsed / FREE_TIER_BYTES : 0,
      assetCount: count,
      images: { count: countOf(images), bytes: sum(images) },
      videos: { count: countOf(videos), bytes: sum(videos) },
      other: {
        count: count - countOf(images) - countOf(videos),
        bytes: bytesUsed - sum(images) - sum(videos),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
