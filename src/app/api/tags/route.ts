import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import prisma from "@/lib/prisma";

export async function GET() {
  const tags = await prisma.tag.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(tags);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description } = body;
    if (!name?.trim()) return NextResponse.json({ error: "missing name" }, { status: 400 });
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
    const tag = await prisma.tag.create({ data: { name: name.trim(), slug, description: description ?? null } });
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
