import { NextResponse } from "next/server";
import { getPageBySlug, upsertPage } from "@/lib/pages";

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
    return NextResponse.json(saved);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  // alias to PUT for convenience
  return PUT(request, { params });
}
