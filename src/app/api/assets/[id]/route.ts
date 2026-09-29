import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { deleteR2Objects, r2KeysFromMeta } from "@/lib/r2";
import { usageForAssets } from "@/lib/media-refs";
import { lockFolderForOrdering } from "@/lib/asset-order";
import { revalidateFor } from "@/lib/revalidate";
import { requireSession, unauthorized } from "@/lib/api-auth";
import {
  TRANSITION_MAX_MEMBERS,
  TRANSITION_MIN_MEMBERS,
  isTransition,
  readTransition,
} from "@/lib/transition";
import { groupsContaining, removeMemberFromGroups } from "@/lib/transition-db";

/** assetId → page slugs that display it, plus the transition groups it is a member of. */
export async function GET(_request: NextRequest, context: any) {
  const session = await requireSession();
  if (!session) return unauthorized();

  let params: any = context?.params as any;
  if (params && typeof params.then === "function") params = await params;
  const id = params?.id as string | undefined;
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const asset = await prisma.asset.findUnique({ where: { id }, select: { folder: true } });
  const [usage, groups] = await Promise.all([
    usageForAssets([id]),
    groupsContaining(asset?.folder ?? null, id),
  ]);
  return NextResponse.json({
    assetId: id,
    usedOn: usage[id] ?? [],
    usedInTransitionGroups: groups,
  });
}

/**
 * Update an asset: rename, move between folders, change alt text, hide/unhide or merge metadata.
 * Moving assigns the next `orderIndex` in the target folder; hiding moves the asset to the end of its
 * folder's order (so it can never be picked as the folder cover) and unhiding leaves it there.
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

    const { filename, folder, alt, meta, hidden, transition } = body;
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

    // ── Transition group edits ────────────────────────────────────────────────
    // Membership and timings live in meta.transition. The server owns the invariants: 2–6 members, no
    // nesting, and never a 1-member group (removing down to one is refused — a member deletion dissolves
    // the group instead, see DELETE).
    if (typeof transition === "object" && transition !== null) {
      if (!isTransition(current)) {
        return NextResponse.json({ error: "NOT_A_TRANSITION" }, { status: 400 });
      }
      const existing = readTransition(current.meta);
      const nextMembers: string[] = Array.isArray(transition.members)
        ? transition.members.filter((m: unknown): m is string => typeof m === "string")
        : existing!.members;

      if (nextMembers.length < TRANSITION_MIN_MEMBERS || nextMembers.length > TRANSITION_MAX_MEMBERS) {
        return NextResponse.json(
          { error: `A transition needs ${TRANSITION_MIN_MEMBERS}–${TRANSITION_MAX_MEMBERS} images.` },
          { status: 400 },
        );
      }

      if (Array.isArray(transition.members)) {
        const found = await prisma.asset.findMany({
          where: { id: { in: nextMembers } },
          select: { id: true, folder: true, mime: true, meta: true },
        });
        if (found.length !== nextMembers.length) {
          return NextResponse.json({ error: "MISSING_ASSET" }, { status: 400 });
        }
        if (found.some((m) => isTransition(m))) {
          return NextResponse.json({ error: "A transition cannot contain another transition." }, { status: 400 });
        }
      }

      const next = {
        ...existing!,
        members: nextMembers,
        animation: transition.animation ?? existing!.animation,
        animateMs: transition.animateMs ?? existing!.animateMs,
        holdMs: transition.holdMs ?? existing!.holdMs,
      };
      data.meta = { ...(current.meta as object ?? {}), transition: next };
      // Keep the representative fields pointing at the (possibly new) first member.
      const firstMember = await prisma.asset.findUnique({
        where: { id: next.members[0] },
        select: { storageKey: true, provider: true, width: true, height: true, publicUrl: true },
      });
      if (firstMember) {
        data.storageKey = firstMember.storageKey;
        data.provider = firstMember.provider;
        data.width = firstMember.width;
        data.height = firstMember.height;
        data.publicUrl = firstMember.publicUrl;
      }
    }

    let updated: any;
    const targetFolder = folderChanging ? folder : current.folder;

    if (typeof hidden === "boolean" || folderChanging) {
      updated = await prisma.$transaction(async (tx: any) => {
        const patch: any = { ...data };
        if (folderChanging) patch.folder = folder;

        if (typeof hidden === "boolean") patch.hidden = hidden;

        if (folderChanging) {
          // Appends at the end of the target folder, hidden or not.
          const agg = await tx.asset.aggregate({ where: { folder, NOT: { id } }, _max: { orderIndex: true } });
          patch.orderIndex = (agg._max.orderIndex ?? 0) + 1;
          if (patch.hidden === undefined) patch.hidden = current.hidden;
          return tx.asset.update({ where: { id }, data: patch });
        }

        if (hidden === true && !current.hidden && targetFolder) {
          // Hiding moves the asset last: covers resolve from the first rows, so this keeps a hidden
          // "before" shot from ever becoming the folder's cover.
          await lockFolderForOrdering(tx, targetFolder);
          const agg = await tx.asset.aggregate({ where: { folder: targetFolder, NOT: { id } }, _max: { orderIndex: true } });
          patch.orderIndex = (agg._max.orderIndex ?? 0) + 1;
        }

        return tx.asset.update({ where: { id }, data: patch });
      });
    } else if (typeof folder !== "undefined") {
      updated = await prisma.asset.update({ where: { id }, data: { ...data, folder } });
    } else {
      updated = await prisma.asset.update({ where: { id }, data });
    }

    await revalidateFor(
      { kind: "asset:updated", assetId: id, folderChanged: folderChanging },
      `asset:update:${id}${folderChanging ? ":moved" : ""}`,
    );

    const [usage, groups] = await Promise.all([
      usageForAssets([id]),
      groupsContaining(updated?.folder ?? null, id),
    ]);
    return NextResponse.json({ ...updated, usedOn: usage[id] ?? [], usedInTransitionGroups: groups });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}

/**
 * Delete an asset: R2 objects, MediaUsage rows and the asset row.
 *
 * Two transition rules apply here:
 *   - a **group** has no objects of its own (its storageKey and meta belong to its first member), so the
 *     R2 step is skipped for it — deleting a group must never delete a member's file;
 *   - deleting a **member** updates the groups that use it: a 3+ group drops the member, and a 2-member
 *     group is dissolved with its row, because a 1-member group must never exist.
 *
 * Returns `usedOn` / `usedInTransitionGroups` so callers can warn — deletion is not blocked, only reported.
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
    const groups = await groupsContaining(asset.folder, id);

    const isGroup = isTransition(asset);
    const r2 = !isGroup && asset.provider === "r2" && asset.storageKey
      ? await deleteR2Objects([asset.storageKey, ...r2KeysFromMeta(asset.meta)])
      : { deleted: 0, failed: [] as string[] };

    let dissolved: string[] = [];
    let updatedGroups = 0;

    await prisma.$transaction(async (tx: any) => {
      if (!isGroup) {
        const result = await removeMemberFromGroups(tx, asset.folder, id);
        dissolved = result.dissolvedIds;
        updatedGroups = result.updated;
        for (const groupId of result.dissolvedIds) {
          await tx.mediaUsage.deleteMany({ where: { assetId: groupId } });
        }
      }
      await tx.mediaUsage.deleteMany({ where: { assetId: id } });
      await tx.asset.delete({ where: { id } });
    });

    await revalidateFor({ kind: "asset:deleted", pageSlugs: usedOn }, `asset:delete:${id}${isGroup ? ":transition" : ""}`);

    return NextResponse.json({
      success: true,
      usedOn,
      usedInTransitionGroups: groups,
      transitions: { updated: updatedGroups, dissolved: dissolved.length },
      r2: { deleted: r2.deleted, failed: r2.failed.length },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
