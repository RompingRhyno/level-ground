import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { resolveUniqueFolderSlug, rewriteFolderSlug, slugifyFolderName } from "@/lib/folders";
import { revalidateFor } from "@/lib/revalidate";
import { deleteR2Objects } from "@/lib/r2";

const FOLDER_NAME_MAX_LENGTH = 100;

async function resolveId(context: any): Promise<number> {
  let params: any = context?.params as any;
  if (params && typeof params.then === "function") params = await params;
  return Number(params?.id);
}

/**
 * Update a folder. A name change also changes the slug (the folder name is the front-facing
 * collection item label), which cascades:
 *   - assets reference folders by slug → rewrite `Asset.folder`
 *   - page JSON embeds slugs (`gallery.filters.folder`, `entityImages` keys, `entityOrder`)
 *   - cached data/HTML for both the old and new URLs is invalidated
 */
export async function PATCH(request: NextRequest, context: any) {
  try {
    const id = await resolveId(context);
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

    const current = await prisma.folder.findUnique({ where: { id } });
    if (!current) return NextResponse.json({ error: "not found" }, { status: 404 });

    const body = await request.json();
    const { name, slug, parentId, description, tags, hidden, order } = body ?? {};

    const nextName = typeof name === "string" ? name.trim() : current.name;
    if (!nextName) return NextResponse.json({ error: "missing name" }, { status: 400 });
    if (nextName.length > FOLDER_NAME_MAX_LENGTH) {
      return NextResponse.json({ error: "name too long" }, { status: 400 });
    }

    // Explicit slug wins; otherwise the slug follows the (possibly renamed) folder name.
    let nextSlug = current.slug;
    if (typeof slug === "string" && slug.trim()) {
      nextSlug = await resolveUniqueFolderSlug(slugifyFolderName(slug.trim()), id);
    } else if (nextName !== current.name) {
      nextSlug = await resolveUniqueFolderSlug(slugifyFolderName(nextName), id);
    }

    const slugChanged = nextSlug !== current.slug;

    const result = await prisma.$transaction(async (tx: any) => {
      const updated = await tx.folder.update({
        where: { id },
        data: {
          name: nextName,
          slug: nextSlug,
          ...(typeof parentId !== "undefined" ? { parentId } : {}),
          ...(typeof description !== "undefined" ? { description } : {}),
          ...(Array.isArray(tags) ? { tags } : {}),
          ...(typeof hidden === "boolean" ? { hidden } : {}),
          ...(typeof order === "number" ? { order } : {}),
        },
      });

      let assetsMoved = 0;
      let pagesUpdated = 0;

      if (slugChanged) {
        const moved = await tx.asset.updateMany({
          where: { folder: current.slug },
          data: { folder: nextSlug },
        });
        assetsMoved = moved.count;

        const pages = (await tx.page.findMany({ select: { slug: true, sections: true } })) as {
          slug: string;
          sections: unknown;
        }[];
        for (const page of pages) {
          const { sections, changed } = rewriteFolderSlug(page.sections, current.slug, nextSlug);
          if (!changed) continue;
          await tx.page.update({ where: { slug: page.slug }, data: { sections: sections as any } });
          pagesUpdated++;
        }
      }

      return { folder: updated, assetsMoved, pagesUpdated };
    });

    await revalidateFor(
      { kind: "folder:updated", slug: result.folder.slug, previousSlug: current.slug },
      `folder:update:${current.slug}${slugChanged ? `->${result.folder.slug}` : ""}`,
    );

    return NextResponse.json({
      folder: result.folder,
      cascade: { slugChanged, assetsMoved: result.assetsMoved, pagesUpdated: result.pagesUpdated },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}

/**
 * Delete a folder. Refuses with 409 when the folder still holds assets unless
 * `?contents=delete` is passed, in which case the assets (R2 objects, MediaUsage rows and
 * Asset rows) are removed first.
 */
export async function DELETE(request: NextRequest, context: any) {
  try {
    const id = await resolveId(context);
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

    const folder = await prisma.folder.findUnique({ where: { id } });
    if (!folder) return NextResponse.json({ error: "not found" }, { status: 404 });

    const deleteContents = new URL(request.url).searchParams.get("contents") === "delete";

    const assets = await prisma.asset.findMany({
      where: { folder: folder.slug },
      select: { id: true, storageKey: true, provider: true },
    });

    if (assets.length > 0 && !deleteContents) {
      return NextResponse.json(
        {
          error: "FOLDER_NOT_EMPTY",
          assetCount: assets.length,
          hint: "Pass ?contents=delete to remove the folder's files as well.",
        },
        { status: 409 },
      );
    }

    let r2 = { deleted: 0, failed: [] as string[] };
    if (assets.length > 0) {
      r2 = await deleteR2Objects(
        assets.filter((a) => a.provider === "r2").map((a) => a.storageKey),
      );

      const ids = assets.map((a) => a.id);
      await prisma.$transaction([
        prisma.mediaUsage.deleteMany({ where: { assetId: { in: ids } } }),
        prisma.asset.deleteMany({ where: { id: { in: ids } } }),
        prisma.folder.delete({ where: { id } }),
      ]);
    } else {
      await prisma.folder.delete({ where: { id } });
    }

    await revalidateFor({ kind: "folder:deleted", slug: folder.slug }, `folder:delete:${folder.slug}`);

    return NextResponse.json({
      success: true,
      deleted: {
        folder: folder.slug,
        assets: assets.length,
        r2Objects: r2.deleted,
        r2Failed: r2.failed.length,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
