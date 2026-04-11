import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const folders = await prisma.folder.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json(folders);
  } catch (err: any) {
    console.error('GET /api/folders error', err);
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, slug, parentId } = body;
    if (!name) return NextResponse.json({ error: "missing name" }, { status: 400 });

    const folderSlug = slug?.toString() || name.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");

    const created = await prisma.folder.create({ data: { name, slug: folderSlug, parentId: parentId ?? null } });
    return NextResponse.json(created);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
