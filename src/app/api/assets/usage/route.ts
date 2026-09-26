import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { usageForAssets } from "@/lib/media-refs";
import { requireSession, unauthorized } from "@/lib/api-auth";

/** Usage lookup for a batch of assets: `{ [assetId]: pageSlug[] }`. */
export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

  try {
    const body = await request.json().catch(() => null);
    const ids = Array.isArray(body?.ids) ? (body.ids as string[]) : [];
    const usage = await usageForAssets(ids);
    return NextResponse.json({ usage });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
