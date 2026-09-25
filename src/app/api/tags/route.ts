import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import prisma from "@/lib/prisma";
import { revalidateFor } from "@/lib/revalidate";

const TAG_NAME_MAX_LENGTH = 100;

/**
 * Rename a tag or edit its description.
 *
 * Deliberately name-only: the tag slug is the public query key (`/projects?tag=<slug>`), so it
 * stays stable. Folder tag lists and page JSON keep referencing the same slug.
 */
export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

    const body = await request.json().catch(() => null);
    const { name, description } = (body ?? {}) as { name?: string; description?: string | null };

    const existing = await prisma.tag.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

    const trimmed = typeof name === "string" ? name.trim() : undefined;
    if (trimmed !== undefined) {
      if (!trimmed) return NextResponse.json({ error: "missing name" }, { status: 400 });
      if (trimmed.length > TAG_NAME_MAX_LENGTH) {
        return NextResponse.json({ error: "name too long" }, { status: 400 });
      }
    }

    const updated = await prisma.tag.update({
      where: { id },
      data: {
        ...(trimmed !== undefined ? { name: trimmed } : {}),
        ...(typeof description !== "undefined" ? { description } : {}),
      },
    });

    revalidateTag("tags", {});
    // Tag names are rendered on folder cards and project pages.
    await revalidateFor({ kind: "tag:changed" }, `tag:update:${updated.slug}`);

    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}


export async function GET() {
  const tags = await prisma.tag.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(tags);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description } = body;

    const trimmedName = typeof name === "string" ? name.trim() : "";

    if (!trimmedName) {
      return NextResponse.json({ error: "missing name" }, { status: 400 });
    }

    if (trimmedName.length > TAG_NAME_MAX_LENGTH) {
      return NextResponse.json({ error: "name too long" }, { status: 400 });
    }

    const slug = trimmedName
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const tag = await prisma.tag.create({
      data: {
        name: trimmedName,
        slug,
        description: description ?? null,
      },
    });

    revalidateTag("tags", {});
    return NextResponse.json(tag);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

    const tag = await prisma.tag.findUnique({ where: { id } });
    if (!tag) return NextResponse.json({ error: "not found" }, { status: 404 });

    // Remove the tag slug from every folder that carries it, then delete the Tag row
    const affectedFolders = await prisma.folder.findMany({
      where: { tags: { has: tag.slug } },
      select: { id: true, tags: true },
    });

    await prisma.$transaction([
      ...affectedFolders.map((f) =>
        prisma.folder.update({
          where: { id: f.id },
          data: { tags: { set: f.tags.filter((t) => t !== tag.slug) } },
        })
      ),
      prisma.tag.delete({ where: { id } }),
    ]);

    revalidateTag("tags", {});
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
