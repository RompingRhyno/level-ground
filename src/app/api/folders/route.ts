import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getFolderCards, resolveUniqueFolderSlug, slugifyFolderName } from "@/lib/folders";
import { revalidateFor } from "@/lib/revalidate";
import { requireSession, unauthorized } from "@/lib/api-auth";

const FOLDER_NAME_MAX_LENGTH = 100;

/** Folder cards for the admin grid: cover, asset count, order, visibility. */
export async function GET() {
  const session = await requireSession();
  if (!session) return unauthorized();

  try {
    const folders = await getFolderCards();
    return NextResponse.json(folders);
  } catch (err: any) {
    console.error("GET /api/folders error", err);
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

  try {
    const body = await request.json();
    const { name, slug, parentId, description, hidden } = body ?? {};

    const trimmedName = typeof name === "string" ? name.trim() : "";
    if (!trimmedName) {
      return NextResponse.json({ error: "missing name" }, { status: 400 });
    }
    if (trimmedName.length > FOLDER_NAME_MAX_LENGTH) {
      return NextResponse.json({ error: "name too long" }, { status: 400 });
    }

    const base = typeof slug === "string" && slug.trim() ? slugifyFolderName(slug.trim()) : slugifyFolderName(trimmedName);
    const folderSlug = await resolveUniqueFolderSlug(base);

    const max = await prisma.folder.aggregate({ _max: { order: true } });
    const order = (max._max.order ?? 0) + 1;

    const created = await prisma.folder.create({
      data: {
        name: trimmedName,
        slug: folderSlug,
        parentId: parentId ?? null,
        description: typeof description === "string" ? description : null,
        hidden: hidden === true,
        order,
      },
    });

    await revalidateFor({ kind: "folder:created" }, `folder:create:${created.slug}`);

    return NextResponse.json(created);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
