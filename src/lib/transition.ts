import prisma from "@/lib/prisma";

/**
 * Before/After transition groups — one Asset row per group, described by `meta.transition`.
 * See docs/transition-groups-plan.md. The row carries the first member's storageKey / provider / dims /
 * publicUrl as its representative, so every existing sweep (covers, usage, pickers) has something to read.
 *
 * Two invariants the rest of the code relies on:
 *   - a group never has fewer than 2 members (a 2-member group loses a member => the group row is deleted)
 *   - a group is never a folder cover (`pickCover` skips `mime = TRANSITION_MIME`)
 */

export type TransitionAnimation = "crossfade" | "slide" | "wipe" | "fadeBlack";

export type TransitionMeta = {
  members: string[];
  animation: TransitionAnimation;
  animateMs: number;
  holdMs: number;
};

export const TRANSITION_MIME = "image/x-transition";
export const TRANSITION_MIN_MEMBERS = 2;
export const TRANSITION_MAX_MEMBERS = 6;

export const TRANSITION_ANIMATIONS: TransitionAnimation[] = ["crossfade", "slide", "wipe", "fadeBlack"];

export const TRANSITION_ANIMATION_LABELS: Record<TransitionAnimation, string> = {
  crossfade: "Crossfade",
  slide: "Slide",
  wipe: "Wipe",
  fadeBlack: "Fade to black",
};

export const DEFAULT_ANIMATE_MS = 500;
export const DEFAULT_HOLD_MS = 2000;
export const MS_STEP = 250;
const MS_MIN = 50;
const MS_MAX = 20000;

export function clampMs(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(MS_MAX, Math.max(MS_MIN, Math.round(value)));
}

/** Read `meta.transition`, or null when this row is not a group (or is a malformed one). */
export function readTransition(meta: unknown): TransitionMeta | null {
  const raw = (meta as { transition?: unknown } | null | undefined)?.transition;
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Partial<TransitionMeta>;
  const members = Array.isArray(t.members)
    ? t.members.filter((m): m is string => typeof m === "string" && m.length > 0)
    : [];
  if (members.length < TRANSITION_MIN_MEMBERS) return null;
  const animation = TRANSITION_ANIMATIONS.includes(t.animation as TransitionAnimation)
    ? (t.animation as TransitionAnimation)
    : "crossfade";
  return {
    members,
    animation,
    animateMs: clampMs(t.animateMs, DEFAULT_ANIMATE_MS),
    holdMs: clampMs(t.holdMs, DEFAULT_HOLD_MS),
  };
}

export function isTransition(asset: { mime?: string | null; meta?: unknown }): boolean {
  return asset.mime === TRANSITION_MIME || readTransition(asset.meta) !== null;
}

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
 * (Only the row — the manager's delete path must never touch the group's R2 objects, they belong to the
 * members. Members' own rows keep their objects.)
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
