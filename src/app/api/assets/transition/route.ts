import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { lockFolderForOrdering } from "@/lib/asset-order";
import { revalidateFor } from "@/lib/revalidate";
import { requireSession, unauthorized } from "@/lib/api-auth";
import {
  DEFAULT_ANIMATE_MS,
  DEFAULT_HOLD_MS,
  TRANSITION_ANIMATIONS,
  TRANSITION_MAX_MEMBERS,
  TRANSITION_MIN_MEMBERS,
  TRANSITION_MIME,
  clampMs,
  isTransition,
  readTransition,
  type TransitionAnimation,
} from "@/lib/transition";
import { nextTransitionName, transitionRowsInFolder } from "@/lib/transition-db";

/** Transition groups in a folder — the manager modal's list. */
export async function GET(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

  const folder = new URL(request.url).searchParams.get("folder")?.trim();
  if (!folder) return NextResponse.json({ error: "missing folder" }, { status: 400 });

  const rows = await transitionRowsInFolder(folder);
  return NextResponse.json(
    rows.map((row) => ({
      id: row.id,
      name: row.filename ?? "Before/After",
      orderIndex: row.orderIndex,
      transition: readTransition(row.meta),
    })),
  );
}

/** Create a transition group from 2–6 assets selected in one folder. */
export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

  try {
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });

    const folderSlug = typeof body.folder === "string" ? body.folder.trim() : "";
    const assetIds: string[] = Array.isArray(body.assetIds)
      ? body.assetIds.filter((id: unknown): id is string => typeof id === "string")
      : [];

    if (!folderSlug) return NextResponse.json({ error: "FOLDER_REQUIRED" }, { status: 400 });
    if (assetIds.length < TRANSITION_MIN_MEMBERS || assetIds.length > TRANSITION_MAX_MEMBERS) {
      return NextResponse.json(
        { error: `A transition needs ${TRANSITION_MIN_MEMBERS}–${TRANSITION_MAX_MEMBERS} images.` },
        { status: 400 },
      );
    }

    const folderRow = await prisma.folder.findUnique({ where: { slug: folderSlug }, select: { id: true } });
    if (!folderRow) return NextResponse.json({ error: "UNKNOWN_FOLDER" }, { status: 400 });

    const found = await prisma.asset.findMany({
      where: { id: { in: assetIds } },
      select: {
        id: true, folder: true, storageKey: true, provider: true,
        width: true, height: true, publicUrl: true, mime: true, meta: true,
      },
    });
    if (found.length !== assetIds.length) {
      return NextResponse.json({ error: "MISSING_ASSET" }, { status: 400 });
    }

    // Keep the caller's order (the modal's drag order) and enforce the membership rules.
    const ordered = assetIds.map((id) => found.find((m) => m.id === id)!);
    if (ordered.some((m) => m.folder !== folderSlug)) {
      return NextResponse.json({ error: "Members must be in this folder." }, { status: 400 });
    }
    if (ordered.some((m) => isTransition(m))) {
      return NextResponse.json({ error: "A transition cannot contain another transition." }, { status: 400 });
    }

    const animation: TransitionAnimation = TRANSITION_ANIMATIONS.includes(body.animation)
      ? body.animation
      : "crossfade";
    const animateMs = clampMs(body.animateMs, DEFAULT_ANIMATE_MS);
    const holdMs = clampMs(body.holdMs, DEFAULT_HOLD_MS);

    const name = await nextTransitionName(folderSlug);
    const first = ordered[0];

    const created = await prisma.$transaction(async (tx: any) => {
      await lockFolderForOrdering(tx, folderSlug);

      // The group takes the first member's slot — where the operator expects to see it in the list.
      const firstMember = await tx.asset.findUnique({
        where: { id: first.id },
        select: { orderIndex: true },
      });
      const max = await tx.asset.aggregate({ where: { folder: folderSlug }, _max: { orderIndex: true } });
      const slot = firstMember?.orderIndex ?? (max._max.orderIndex ?? 0) + 1;

      const tail = await tx.asset.findMany({
        where: { folder: folderSlug, orderIndex: { gte: slot } },
        select: { id: true },
        orderBy: { orderIndex: "asc" },
      });
      if (tail.length) {
        // Nulling first keeps the unique index happy while the tail is reassigned (NULLs do not collide).
        await tx.asset.updateMany({
          where: { id: { in: tail.map((a: { id: string }) => a.id) } },
          data: { orderIndex: null },
        });
        for (let i = 0; i < tail.length; i++) {
          await tx.asset.update({ where: { id: tail[i].id }, data: { orderIndex: slot + i + 1 } });
        }
      }

      return tx.asset.create({
        data: {
          storageKey: first.storageKey,
          provider: first.provider,
          filename: name,
          mime: TRANSITION_MIME,
          size: null,
          width: first.width,
          height: first.height,
          folder: folderSlug,
          orderIndex: slot,
          publicUrl: first.publicUrl,
          alt: name,
          meta: {
            transition: {
              members: ordered.map((m) => m.id),
              animation,
              animateMs,
              holdMs,
            },
            uploadedAt: new Date().toISOString(),
          },
        },
      });
    });

    await revalidateFor({ kind: "asset:created" }, `transition:create:${created.id}`);
    return NextResponse.json(created);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
