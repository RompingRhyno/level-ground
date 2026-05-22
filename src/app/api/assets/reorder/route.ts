import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orderedIds } = body as { orderedIds?: string[] };

    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return NextResponse.json({ error: "missing orderedIds" }, { status: 400 });
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Null out orderIndex first to avoid unique constraint violations
      // during the sequential reassignment (PostgreSQL checks per-statement).
      await tx.asset.updateMany({
        where: { id: { in: orderedIds } },
        data: { orderIndex: null },
      });
      for (let i = 0; i < orderedIds.length; i++) {
        await tx.asset.update({
          where: { id: orderedIds[i] },
          data: { orderIndex: i + 1 },
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
