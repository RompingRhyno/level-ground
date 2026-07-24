import { NextResponse } from "next/server";
import { revalidateTag, revalidatePath } from "next/cache";
import { getPageBySlug, upsertPage, ensureCollectionTemplates } from "@/lib/pages";
import { reconcileMediaUsage } from "@/lib/gallery-utils";
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
      revalidateTag(`page:${s}`, {});
      revalidatePath(`/${s}`);
    }

    // Revalidate old slug if it changed
    if (slug !== saved.slug) {
      revalidateTag(`page:${slug}`, {});
      revalidatePath(`/${slug}`);
    }
    revalidateTag(`page:${saved.slug}`, {});
    revalidatePath(`/${saved.slug}`);

    // Label or slug changes affect nav
    if (slug !== saved.slug || body.label !== undefined) {
      revalidateTag("global:nav", {});
      revalidatePath("/");
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

    revalidateTag(`page:${slug}`, {});
    revalidateTag("global:nav", {});

    revalidatePath(`/${slug}`);
    revalidatePath("/");

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}

