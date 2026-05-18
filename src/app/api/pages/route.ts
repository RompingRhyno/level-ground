import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getPages, upsertPage, reorderPages } from "@/lib/pages";
import { reconcileMediaUsage } from "@/lib/gallery-utils";

export async function GET() {
  const pages = await getPages();
  return NextResponse.json(pages);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body || !body.slug) {
      return NextResponse.json({ error: "missing slug" }, { status: 400 });
    }

    const saved = await upsertPage(body);
    await reconcileMediaUsage(saved.slug, saved.sections);
    revalidateTag(`page:${saved.slug}`, {});
    revalidateTag("global:nav", {});

    return NextResponse.json(saved);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    if (!Array.isArray(body?.slugs)) {
      return NextResponse.json({ error: "missing slugs array" }, { status: 400 });
    }
    await reorderPages(body.slugs as string[]);
    revalidateTag("global:nav", {});
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}

