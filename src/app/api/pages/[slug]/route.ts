import { NextResponse } from "next/server";
import { getPageBySlug, upsertPage, ensureCollectionTemplates } from "@/lib/pages";
import { reconcileMediaUsage } from "@/lib/media-refs";
import { applyRevalidationPlan, pathForSlug, revalidateFor } from "@/lib/revalidate";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPageBySlug(slug);
  if (!page) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(page);
}

export async function PUT(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const body = await request.json();

    if (!body) return NextResponse.json({ error: "missing body" }, { status: 400 });

    // Ensure slug matches route
    if (!body.slug) body.slug = slug;

    const saved = await upsertPage(body);
    await reconcileMediaUsage(saved.slug, saved.sections);
    const newTemplates = await ensureCollectionTemplates(saved.sections);
    for (const s of newTemplates) {
      applyRevalidationPlan({ tags: [`page:${s}`], paths: [pathForSlug(s)] }, `template:${s}`);
    }

    // Page save invalidates the page itself, the nav, the collection-page set, the home route.
    await revalidateFor({ kind: "page:saved", slug: saved.slug });

    // Revalidate the previous slug's route if it changed
    if (slug !== saved.slug) {
      applyRevalidationPlan(
        { tags: [`page:${slug}`], paths: [pathForSlug(slug)] },
        `page:renamed:${slug}->${saved.slug}`,
      );
    }

    return NextResponse.json(saved);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  // alias to PUT for convenience
  return PUT(request, { params });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;

    if (slug === "home") {
      return NextResponse.json({ error: "cannot delete home page" }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.mediaUsage.deleteMany({ where: { pageSlug: slug } }),
      prisma.page.delete({ where: { slug } }),
    ]);

    await revalidateFor({ kind: "page:deleted", slug });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
