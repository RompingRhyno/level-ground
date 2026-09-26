import { NextResponse } from "next/server";
import { revalidateTag, revalidatePath } from "next/cache";
import { getPages, upsertPage, reorderPages, ensureCollectionTemplates } from "@/lib/pages";
import { reconcileMediaUsage } from "@/lib/media-refs";
import { revalidateFor } from "@/lib/revalidate";
import { requireSession, unauthorized } from "@/lib/api-auth";

export async function GET() {
  const session = await requireSession();
  if (!session) return unauthorized();

  const pages = await getPages();
  return NextResponse.json(pages);
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

  try {
    const body = await request.json();

    if (!body || !body.slug) {
      return NextResponse.json({ error: "missing slug" }, { status: 400 });
    }

    const saved = await upsertPage(body);
    await reconcileMediaUsage(saved.slug, saved.sections);
    const newTemplates = await ensureCollectionTemplates(saved.sections);
    for (const s of newTemplates) {
      revalidateTag(`page:${s}`, {});
      revalidatePath(`/${s}`);
    }

    // Page save invalidates the page itself, the nav, the collection-page set, the home route.
    await revalidateFor({ kind: "page:saved", slug: saved.slug });

    return NextResponse.json(saved);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

  try {
    const body = await request.json();
    if (!Array.isArray(body?.slugs)) {
      return NextResponse.json({ error: "missing slugs array" }, { status: 400 });
    }
    await reorderPages(body.slugs as string[]);
    revalidateTag("global:nav", {});
    revalidateTag("global:pages", {});
    revalidatePath("/");
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
