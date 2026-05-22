import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import prisma from "@/lib/prisma";
import { resolveDynamicAffectedPages } from "@/lib/gallery-utils";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { ids, folder } = body as { ids?: string[]; folder?: string | null };

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "missing ids" }, { status: 400 });
    }
    if (typeof folder === "undefined") {
      return NextResponse.json({ error: "missing folder" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      if (!folder) {
        // Removing from folder — clear orderIndex for all
        await tx.asset.updateMany({
          where: { id: { in: ids } },
          data: { folder: null, orderIndex: null },
        });
        return;
      }

      // Get current max orderIndex in target folder (excluding the assets being moved)
      const agg = await tx.asset.aggregate({
        where: { folder, NOT: { id: { in: ids } } },
        _max: { orderIndex: true },
      });
      let nextIndex = (agg._max.orderIndex ?? 0) + 1;

      // Null out orderIndex on all moving assets first to avoid unique
      // constraint violations during sequential reassignment.
      await tx.asset.updateMany({
        where: { id: { in: ids } },
        data: { orderIndex: null },
      });

      // Assign sequential indices after the current max in target folder
      for (const id of ids) {
        await tx.asset.update({
          where: { id },
          data: { folder, orderIndex: nextIndex++ },
        });
      }
    });

    const dynamicSlugs = await resolveDynamicAffectedPages();
    for (const slug of dynamicSlugs) {
      revalidateTag(`page:${slug}`, {});
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
