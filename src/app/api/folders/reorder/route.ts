import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { revalidateFor } from "@/lib/revalidate";

/** Persist the admin grid's drag order. Mirrors /api/assets/reorder. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orderedIds } = body as { orderedIds?: number[] };

    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return NextResponse.json({ error: "missing orderedIds" }, { status: 400 });
    }
    const ids = orderedIds.map((id) => Number(id)).filter((id) => Number.isFinite(id));
    if (!ids.length) return NextResponse.json({ error: "invalid orderedIds" }, { status: 400 });

    await prisma.$transaction(async (tx: any) => {
      for (let i = 0; i < ids.length; i++) {
        await tx.folder.update({ where: { id: ids[i] }, data: { order: i + 1 } });
      }
    });

    await revalidateFor({ kind: "folders:reordered" }, "folders:reorder");

    return NextResponse.json({ ok: true, count: ids.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
