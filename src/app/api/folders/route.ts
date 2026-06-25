import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const FOLDER_NAME_MAX_LENGTH = 100;

export async function GET() {
  try {
    const folders = await prisma.folder.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json(folders);
  } catch (err: any) {
    console.error("GET /api/folders error", err);
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, slug, parentId } = body;

    const trimmedName = typeof name === "string" ? name.trim() : "";
    const trimmedSlug = typeof slug === "string" ? slug.trim() : "";

    if (!trimmedName) {
      return NextResponse.json({ error: "missing name" }, { status: 400 });
    }

    if (trimmedName.length > FOLDER_NAME_MAX_LENGTH) {
      return NextResponse.json({ error: "name too long" }, { status: 400 });
    }

    if (trimmedSlug && trimmedSlug.length > FOLDER_NAME_MAX_LENGTH) {
      return NextResponse.json({ error: "slug too long" }, { status: 400 });
    }

    const folderSlug =
      trimmedSlug ||
      trimmedName
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "");

    const created = await prisma.folder.create({
      data: {
        name: trimmedName,
        slug: folderSlug,
        parentId: parentId ?? null,
      },
    });

    return NextResponse.json(created);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}