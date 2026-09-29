/**
 * Before/After transition groups — pure helpers and constants (no Prisma import, so client components can
 * use them). DB-backed helpers live in `transition-db.ts`.
 * See docs/transition-groups-plan.md.
 *
 * A group is an Asset row whose `meta.transition` carries this shape; for the overview every group keeps
 * its first member's storageKey / provider / dims / publicUrl as its representative.
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

/** A resolved member, ready to render (what the tile needs). */
export type TransitionMember = { id: string; publicUrl: string; alt: string | null };

/** A group resolved for rendering: its settings plus its members in order. */
export type ResolvedTransition = { transition: TransitionMeta; members: TransitionMember[] };

/**
 * The same render map, built from a list that already contains the member rows — for client-side surfaces
 * (the media manager, the editor preview) where the fetch returns the whole folder. Rows that are missing or
 * have no URL are dropped, so a half-deleted group renders nothing rather than breaking.
 */
export function transitionsFromRows(
  rows: { id: string; publicUrl: string | null; alt: string | null; meta: unknown }[],
): Record<string, ResolvedTransition> {
  type Row = { id: string; publicUrl: string | null; alt: string | null; meta: unknown };
  const byId = new Map<string, Row>(rows.map((r) => [r.id, r]));
  const out: Record<string, ResolvedTransition> = {};
  for (const row of rows) {
    const transition = readTransition(row.meta);
    if (!transition) continue;
    const members = transition.members
      .map((id) => byId.get(id))
      .filter((r): r is Row => Boolean(r?.publicUrl))
      .map((r) => ({ id: r.id, publicUrl: r.publicUrl!, alt: r.alt }));
    if (members.length >= TRANSITION_MIN_MEMBERS) {
      out[row.id] = { transition, members };
    }
  }
  return out;
}
