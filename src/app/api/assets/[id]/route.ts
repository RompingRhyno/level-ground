import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { deleteR2Objects, r2KeysFromMeta } from "@/lib/r2";
import { usageForAssets } from "@/lib/media-refs";
import { revalidateFor } from "@/lib/revalidate";
import { requireSession, unauthorized } from "@/lib/api-auth";

/** assetId → page slugs that display it (used for delete warnings and card badges). */
export async function GET(_request: NextRequest, context: any) {
  const session = await requireSession();
  if (!session) return unauthorized();

  let params: any = context?.params as any;
  if (params && typeof params.then === "function") params = await params;
  const id = params?.id as string | undefined;
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const usage = await usageForAssets([id]);
  return NextResponse.json({ assetId: id, usedOn: usage[id] ?? [] });
}

/**
 * Update an asset: rename, move between folders, change alt text or merge metadata.
 * Moving assigns the next `orderIndex` in the target folder.
 */
export async function PATCH(request: NextRequest, context: any) {
  const session = await requireSession();
  if (!session) return unauthorized();

  try {
    let params: any = context?.params as any;
    if (params && typeof params.then === "function") params = await params;
    const id = params?.id as string | undefined;
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });

    const { filename, folder, alt, meta } = body;
    const current = await prisma.asset.findUnique({ where: { id } });
    if (!current) return NextResponse.json({ error: "not found" }, { status: 404 });

    const data: any = {};
    if (typeof filename === "string" && filename.trim()) data.filename = filename.trim();
    if (typeof alt !== "undefined") data.alt = alt;
    if (meta && typeof meta === "object") data.meta = { ...(current.meta as object ?? {}), ...meta };

    const folderChanging = typeof folder !== "undefined" && folder !== current.folder;
    if (folderChanging && folder) {
      const target = await prisma.folder.findUnique({ where: { slug: folder }, select: { id: true } });
      if (!target) {
        return NextResponse.json({ error: "UNKNOWN_FOLDER", message: `No folder with slug "${folder}".` }, { status: 400 });
      }
    }

    let updated: any;
    if (typeof folder !== "undefined") {
      if (folderChanging) {
        if (folder) {
          updated = await prisma.$transaction(async (tx: any) => {
            const agg = await tx.asset.aggregate({
              where: { folder, NOT: { id } },
              _max: { orderIndex: true },
            });
            const nextIndex = (agg._max.orderIndex ?? 0) + 1;
            return tx.asset.update({ where: { id }, data: { ...data, folder, orderIndex: nextIndex } });
          });
        } else {
          // Removing a folder assignment (legacy files only — new uploads always have one).
          updated = await prisma.asset.update({ where: { id }, data: { ...data, folder: null, orderIndex: null } });
        }
      } else {
        updated = await prisma.asset.update({ where: { id }, data: { ...data, folder } });
      }
    } else {
      updated = await prisma.asset.update({ where: { id }, data });
    }

    await revalidateFor(
      { kind: "asset:updated", assetId: id, folderChanged: folderChanging },
      `asset:update:${id}${folderChanging ? ":moved" : ""}`,
    );

    const usage = await usageForAssets([id]);
    return NextResponse.json({ ...updated, usedOn: usage[id] ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}

/**
 * Delete an asset: R2 object, MediaUsage rows and the asset row.
 * Returns `usedOn` so callers can report (or warn about) static references — deletion is not
 * blocked, only reported; the admin UI asks first.
 */
export async function DELETE(request: NextRequest, context: any) {
  const session = await requireSession();
  if (!session) return unauthorized();

  try {
    let params: any = context?.params as any;
    if (params && typeof params.then === "function") params = await params;
    const id = params?.id as string | undefined;
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) return NextResponse.json({ error: "not found" }, { status: 404 });

    const usage = await usageForAssets([id]);
    const usedOn = usage[id] ?? [];

    const r2 = asset.provider === "r2" && asset.storageKey
      ? await deleteR2Objects([asset.storageKey, ...r2KeysFromMeta(asset.meta)])
      : { deleted: 0, failed: [] as string[] };

    await prisma.$transaction([
      prisma.mediaUsage.deleteMany({ where: { assetId: id } }),
      prisma.asset.delete({ where: { id } }),
    ]);

    await revalidateFor({ kind: "asset:deleted", pageSlugs: usedOn }, `asset:delete:${id}`);

    return NextResponse.json({
      success: true,
      usedOn,
      r2: { deleted: r2.deleted, failed: r2.failed.length },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
