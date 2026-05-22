import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { resolveDynamicAffectedPages } from "@/lib/gallery-utils";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const folder = url.searchParams.get("folder");
  const tag = url.searchParams.get("tag");
  const where: any = {};
  if (folder) where.folder = folder;
  if (tag) where.tags = { has: tag };

  const rows = await prisma.asset.findMany({
    where,
    orderBy: folder
      ? [{ orderIndex: "asc" }, { createdAt: "asc" }]
      : [{ createdAt: "desc" }],
    take: 200,
  });
  const sorted = rows.map((r: any) => ({ ...r, tags: Array.isArray(r.tags) ? [...r.tags].sort() : r.tags }));
  return NextResponse.json(sorted);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { key, filename, mime, size, folder, publicUrl, alt, tags } = body;
    if (!key) return NextResponse.json({ error: "missing key" }, { status: 400 });

    const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      let orderIndex: number | undefined;
      if (folder) {
        const agg = await tx.asset.aggregate({
          where: { folder },
          _max: { orderIndex: true },
        });
        orderIndex = (agg._max.orderIndex ?? 0) + 1;
      }
      return tx.asset.create({
        data: {
          storageKey: key,
          provider: "r2",
          filename,
          mime,
          size,
          folder,
          orderIndex,
          publicUrl,
          alt,
          meta: { uploadedAt: new Date().toISOString() },
          tags,
        },
      });
    });

    // New upload may appear in dynamic galleries — revalidate those pages
    const dynamicSlugs = await resolveDynamicAffectedPages();
    for (const slug of dynamicSlugs) {
      revalidateTag(`page:${slug}`, {});
    }

    return NextResponse.json(created);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}

