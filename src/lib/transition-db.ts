import prisma from "@/lib/prisma";
import {
  readTransition,
  TRANSITION_MIME,
  TRANSITION_MIN_MEMBERS,
  type ResolvedTransition,
} from "@/lib/transition";

/**
 * DB-backed half of the transition-group helpers (the pure half is `transition.ts`).
 * Two invariants the rest of the code relies on:
 *   - a group never has fewer than 2 members (a 2-member group loses a member => the group row is deleted)
 *   - a group is never a folder cover (`pickCover` skips `mime = TRANSITION_MIME`)
 */

/** "Before/After N" — generated per folder, never editable. */
export async function nextTransitionName(folderSlug: string): Promise<string> {
  const rows = await prisma.asset.findMany({
    where: { folder: folderSlug, filename: { startsWith: "Before/After " } },
    select: { filename: true },
  });
  let max = 0;
  for (const row of rows) {
    const m = /^Before\/After (\d+)$/.exec(row.filename ?? "");
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `Before/After ${max + 1}`;
}

/** Every group in a folder, in list order. */
export function transitionRowsInFolder(folderSlug: string) {
  return prisma.asset.findMany({
    where: { folder: folderSlug, mime: TRANSITION_MIME },
    select: { id: true, filename: true, orderIndex: true, meta: true },
    orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
  });
}

/**
 * Resolve render data for whichever rows in `assets` are groups: keyed by the group's id, so a renderer can
 * do `const t = transitions[asset.id]` and decide between a TransitionTile and a plain Image. Rows whose
 * members are missing (a half-deleted group) are dropped rather than rendered broken.
 */
export async function resolveTransitions(
  assets: { id: string; meta: unknown }[],
): Promise<Record<string, ResolvedTransition>> {
  const groups = assets
    .map((a) => ({ id: a.id, transition: readTransition(a.meta) }))
    .filter((g): g is { id: string; transition: NonNullable<ReturnType<typeof readTransition>> } => g.transition !== null);
  if (!groups.length) return {};

  const memberIds = [...new Set(groups.flatMap((g) => g.transition.members))];
  const rows = await prisma.asset.findMany({
    where: { id: { in: memberIds } },
    select: { id: true, publicUrl: true, alt: true },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));

  const out: Record<string, ResolvedTransition> = {};
  for (const group of groups) {
    const members = group.transition.members
      .map((id) => byId.get(id))
      .filter((r): r is { id: string; publicUrl: string | null; alt: string | null } => Boolean(r?.publicUrl))
      .map((r) => ({ id: r.id, publicUrl: r.publicUrl!, alt: r.alt }));
    if (members.length >= TRANSITION_MIN_MEMBERS) {
      out[group.id] = { transition: group.transition, members };
    }
  }
  return out;
}

/** Groups in a folder that use this asset as a member — the delete/move warning reads this. */
export async function groupsContaining(folderSlug: string | null, assetId: string) {
  if (!folderSlug) return [];
  const rows = await prisma.asset.findMany({
    where: { folder: folderSlug, mime: TRANSITION_MIME },
    select: { id: true, filename: true, meta: true },
  });
  return rows
    .filter((row) => readTransition(row.meta)?.members.includes(assetId))
    .map((row) => ({ id: row.id, name: row.filename ?? "Before/After" }));
}

type Tx = {
  asset: {
    findMany: (args: unknown) => Promise<{ id: string; filename: string | null; meta: unknown }[]>;
    update: (args: unknown) => Promise<unknown>;
    delete: (args: unknown) => Promise<unknown>;
  };
};

/**
 * Remove a deleted asset from every group that used it.
 * A group left with one member is dissolved: the group row goes, so a 1-member group can never exist.
 * (Only the row — the caller must never touch the group's R2 objects, they belong to the members.)
 */
export async function removeMemberFromGroups(tx: Tx, folderSlug: string | null, assetId: string) {
  if (!folderSlug) return { updated: 0, dissolved: 0, dissolvedIds: [] as string[] };
  const rows = await tx.asset.findMany({
    where: { folder: folderSlug, mime: TRANSITION_MIME },
    select: { id: true, filename: true, meta: true },
  });

  let updated = 0;
  let dissolved = 0;
  const dissolvedIds: string[] = [];

  for (const row of rows) {
    const current = readTransition(row.meta);
    if (!current || !current.members.includes(assetId)) continue;

    const remaining = current.members.filter((m) => m !== assetId);
    if (remaining.length < TRANSITION_MIN_MEMBERS) {
      await tx.asset.delete({ where: { id: row.id } });
      dissolved += 1;
      dissolvedIds.push(row.id);
      continue;
    }

    const meta = { ...((row.meta as object) ?? {}), transition: { ...current, members: remaining } };
    await tx.asset.update({ where: { id: row.id }, data: { meta } });
    updated += 1;
  }

  return { updated, dissolved, dissolvedIds };
}
