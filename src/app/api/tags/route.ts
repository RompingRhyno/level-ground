import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import prisma from "@/lib/prisma";
import { revalidateFor } from "@/lib/revalidate";
import { regenerateAltsForTags, regenerateFolderAlts } from "@/lib/alt-db";
import { requireSession, unauthorized } from "@/lib/api-auth";
import { SERVICE_NAME_BY_SLUG } from "@/lib/services";

const TAG_NAME_MAX_LENGTH = 100;

/**
 * Rename a tag or edit its description.
 *
 * Deliberately name-only: the tag slug is the public query key (`/projects?tag=<slug>`), so it
 * stays stable. Folder tag lists and page JSON keep referencing the same slug.
 */
export async function PATCH(request: NextRequest) {
  const session = await requireSession();
  if (!session) return unauthorized();

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

    // A tag's name is part of every alt text that names it; refresh those folders' photos.
    await regenerateAltsForTags([updated.slug]);

    revalidateTag("tags", {});
    // Tag names are rendered on folder cards and project pages.
    await revalidateFor({ kind: "tag:changed" }, `tag:update:${updated.slug}`);

    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}


export async function GET() {
  const session = await requireSession();
  if (!session) return unauthorized();

  const tags = await prisma.tag.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(tags);
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

  try {
    const body = await request.json();
    const { name, description, service } = body;

    const trimmedName = typeof name === "string" ? name.trim() : "";

    if (!trimmedName) {
      return NextResponse.json({ error: "missing name" }, { status: 400 });
    }

    if (trimmedName.length > TAG_NAME_MAX_LENGTH) {
      return NextResponse.json({ error: "name too long" }, { status: 400 });
    }

    // A tag belongs to a service category (that is what files it under a service everywhere else),
    // so a slug that is not part of the vocabulary is rejected rather than stored as an orphan.
    const serviceSlug = typeof service === "string" && service.trim() ? service.trim() : null;
    if (serviceSlug && !SERVICE_NAME_BY_SLUG[serviceSlug]) {
      return NextResponse.json({ error: "unknown service" }, { status: 400 });
    }

    // Same rules as slugifyFolderName: underscores become hyphens, hyphen runs collapse.
    const slug = trimmedName
      .toLowerCase()
      .replace(/_+/g, "-")
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");

    const tag = await prisma.tag.create({
      data: {
        name: trimmedName,
        slug,
        description: description ?? null,
        service: serviceSlug,
      },
    });

    revalidateTag("tags", {});
    return NextResponse.json(tag);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await requireSession();
  if (!session) return unauthorized();

  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

    const tag = await prisma.tag.findUnique({ where: { id } });
    if (!tag) return NextResponse.json({ error: "not found" }, { status: 404 });

    // Remove the tag slug from every folder that carries it, then delete the Tag row
    const affectedFolders = await prisma.folder.findMany({
      where: { tags: { has: tag.slug } },
      select: { id: true, tags: true, slug: true },
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

    // The deleted tag leaves each folder's tag list, so the alts that named it change.
    for (const folder of affectedFolders) {
      await regenerateFolderAlts(folder.slug);
    }

    revalidateTag("tags", {});
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
