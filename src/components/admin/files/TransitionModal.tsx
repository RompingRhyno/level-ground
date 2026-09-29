"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { api } from "./api";
import { filenameStem, isVideoAsset, type AssetData } from "./types";
import TransitionTile from "@/components/sections/TransitionTile";
import {
  DEFAULT_ANIMATE_MS,
  DEFAULT_HOLD_MS,
  MS_STEP,
  TRANSITION_ANIMATIONS,
  TRANSITION_ANIMATION_LABELS,
  TRANSITION_MAX_MEMBERS,
  TRANSITION_MIN_MEMBERS,
  clampMs,
  type TransitionAnimation,
  type TransitionMeta,
} from "@/lib/transition";

type GroupRow = {
  id: string;
  name: string;
  orderIndex: number | null;
  transition: (TransitionMeta & { members: string[] }) | null;
};

/**
 * Manage the folder's transition groups.
 *
 * Create mode: opens with the files selected in the toolbar (their display order). Edit mode: opens with a
 * group's members and timings. Membership is decided by the selection before opening — there is no picker in
 * here — but members can be reordered (drag) and removed, and the group cannot be saved below two members.
 */
export default function TransitionModal({
  folderSlug,
  assets,
  initialIds,
  initialGroup,
  onClose,
  onSaved,
}: {
  folderSlug: string;
  assets: AssetData[];
  initialIds?: string[];
  initialGroup?: GroupRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [members, setMembers] = useState<string[]>(
    initialGroup?.transition?.members ?? initialIds ?? [],
  );
  const [animation, setAnimation] = useState<TransitionAnimation>(
    initialGroup?.transition?.animation ?? "crossfade",
  );
  const [animateMs, setAnimateMs] = useState<number>(initialGroup?.transition?.animateMs ?? DEFAULT_ANIMATE_MS);
  const [holdMs, setHoldMs] = useState<number>(initialGroup?.transition?.holdMs ?? DEFAULT_HOLD_MS);
  const [editingId, setEditingId] = useState<string | null>(initialGroup?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const byId = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const preview = members
    .map((id) => byId.get(id))
    .filter((a): a is AssetData => Boolean(a && a.publicUrl))
    .map((a) => ({ id: a.id, publicUrl: a.publicUrl!, alt: a.alt ?? null }));

  const canSave = members.length >= TRANSITION_MIN_MEMBERS && members.length <= TRANSITION_MAX_MEMBERS;

  useEffect(() => {
    let cancelled = false;
    api<GroupRow[]>(`/api/assets/transition?folder=${encodeURIComponent(folderSlug)}`)
      .then((rows) => {
        if (!cancelled) setGroups(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [folderSlug]);

  function moveMember(from: number, to: number) {
    if (from === to || to < 0 || to >= members.length) return;
    setMembers((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  function removeMember(index: number) {
    // Never let the editor reach a 1-member group: below two the group does not exist.
    if (members.length <= TRANSITION_MIN_MEMBERS) return;
    setMembers((prev) => prev.filter((_, i) => i !== index));
  }

  function loadGroup(group: GroupRow) {
    setEditingId(group.id);
    setMembers(group.transition?.members ?? []);
    setAnimation(group.transition?.animation ?? "crossfade");
    setAnimateMs(group.transition?.animateMs ?? DEFAULT_ANIMATE_MS);
    setHoldMs(group.transition?.holdMs ?? DEFAULT_HOLD_MS);
    setError(null);
  }

  async function save() {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      const payload = {
        members,
        animation,
        animateMs: clampMs(animateMs, DEFAULT_ANIMATE_MS),
        holdMs: clampMs(holdMs, DEFAULT_HOLD_MS),
      };
      if (editingId) {
        await api(`/api/assets/${editingId}`, { method: "PATCH", body: JSON.stringify({ transition: payload }) });
      } else {
        await api("/api/assets/transition", {
          method: "POST",
          body: JSON.stringify({ folder: folderSlug, assetIds: members, ...payload }),
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeGroup() {
    if (!editingId) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/assets/${editingId}`, { method: "DELETE" });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-[min(94vw,52rem)] flex-col overflow-hidden rounded-lg border border-(--color-border) bg-(--color-bg-primary)"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-(--color-border) px-4 py-3">
          <h2 className="text-base font-medium text-(--color-brand-dark)">Transitions</h2>
          <button type="button" onClick={onClose} className="rounded px-2 py-1 text-sm admin-btn">
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {groups.length > 0 && (
            <div>
              <div className="mb-2 text-sm font-medium text-(--color-brand-dark)">In this folder</div>
              <div className="space-y-1">
                {groups.map((group) => {
                  const first = group.transition?.members[0] ? byId.get(group.transition.members[0]) : undefined;
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => loadGroup(group)}
                      className={`flex w-full items-center gap-3 rounded border px-2 py-1.5 text-left ${
                        group.id === editingId ? "border-(--btn-select) ring-1 ring-(--btn-select)" : "border-(--color-border) hover:bg-white"
                      }`}
                    >
                      <span className="relative h-8 w-14 shrink-0 overflow-hidden rounded bg-(--color-bg-secondary)">
                        {first?.publicUrl && (
                          <Image src={first.publicUrl} alt="" fill sizes="56px" className="object-cover" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">{group.name}</span>
                      <span className="shrink-0 text-xs text-(--color-text-light)">
                        {group.transition?.members.length ?? 0} images
                        {group.transition ? ` · ${TRANSITION_ANIMATION_LABELS[group.transition.animation]}` : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <div className="mb-2 text-sm font-medium text-(--color-brand-dark)">Images</div>
            <div className="flex flex-wrap items-stretch gap-2">
              {members.map((id, index) => {
                const asset = byId.get(id);
                const video = asset ? isVideoAsset(asset) : false;
                return (
                  <div
                    key={id}
                    draggable
                    onDragStart={() => setDragFrom(index)}
                    onDragEnter={() => setDragOver(index)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (dragFrom !== null) moveMember(dragFrom, index);
                      setDragFrom(null);
                      setDragOver(null);
                    }}
                    onDragEnd={() => {
                      setDragFrom(null);
                      setDragOver(null);
                    }}
                    className={`relative h-20 w-32 shrink-0 cursor-grab overflow-hidden rounded border bg-white ${
                      dragOver === index ? "ring-2 ring-(--btn-select)" : "border-(--color-border)"
                    } ${dragFrom === index ? "opacity-50" : ""}`}
                  >
                    {asset?.publicUrl ? (
                      <Image
                        src={asset.publicUrl}
                        alt={asset.alt ?? ""}
                        fill
                        sizes="128px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-xs text-(--color-text-light)">
                        missing
                      </div>
                    )}
                    <span className="absolute left-1 top-1 rounded bg-black/70 px-1 text-[10px] text-white">
                      {index + 1}
                    </span>
                    {video && (
                      <span className="absolute right-1 top-1 rounded bg-black/70 px-1 text-[10px] text-white">video</span>
                    )}
                    {members.length > TRANSITION_MIN_MEMBERS && (
                      <button
                        type="button"
                        onClick={() => removeMember(index)}
                        aria-label={`Remove ${asset?.filename ?? "image"}`}
                        className="absolute right-1 bottom-1 rounded bg-black/70 px-1.5 text-xs text-white hover:bg-black"
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
              {members.length < TRANSITION_MAX_MEMBERS && (
                <div className="flex h-20 w-32 shrink-0 items-center justify-center rounded border border-dashed border-(--color-border) px-2 text-center text-[11px] text-(--color-text-light)">
                  Select more files and reopen to add
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-(--color-text-light)">
              {members.length} of {TRANSITION_MAX_MEMBERS} · drag to reorder
            </p>
          </div>

          {preview.length >= TRANSITION_MIN_MEMBERS && (
            <div>
              <div className="mb-2 text-sm font-medium text-(--color-brand-dark)">Preview</div>
              <div className="relative aspect-video w-full max-w-md overflow-hidden rounded">
                <TransitionTile
                  members={preview}
                  transition={{ animation, animateMs, holdMs }}
                  sizes="(max-width: 1023px) 100vw, 480px"
                  quality={75}
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-(--color-brand-dark)">Animation</span>
              <select
                value={animation}
                onChange={(event) => setAnimation(event.target.value as TransitionAnimation)}
                className="rounded border border-(--color-border) bg-white px-2 py-1 text-sm"
              >
                {TRANSITION_ANIMATIONS.map((value) => (
                  <option key={value} value={value}>
                    {TRANSITION_ANIMATION_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-(--color-brand-dark)">Duration (ms)</span>
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setAnimateMs((v) => clampMs(v - MS_STEP, DEFAULT_ANIMATE_MS))}
                  className="rounded px-2 py-1 text-sm admin-btn"
                >
                  −
                </button>
                <input
                  type="number"
                  step={MS_STEP}
                  min={50}
                  value={animateMs}
                  onChange={(event) => setAnimateMs(clampMs(Number(event.target.value), DEFAULT_ANIMATE_MS))}
                  className="w-20 rounded border border-(--color-border) bg-white px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setAnimateMs((v) => clampMs(v + MS_STEP, DEFAULT_ANIMATE_MS))}
                  className="rounded px-2 py-1 text-sm admin-btn"
                >
                  +
                </button>
              </span>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-(--color-brand-dark)">Hold per image (ms)</span>
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setHoldMs((v) => clampMs(v - MS_STEP, DEFAULT_HOLD_MS))}
                  className="rounded px-2 py-1 text-sm admin-btn"
                >
                  −
                </button>
                <input
                  type="number"
                  step={MS_STEP}
                  min={50}
                  value={holdMs}
                  onChange={(event) => setHoldMs(clampMs(Number(event.target.value), DEFAULT_HOLD_MS))}
                  className="w-20 rounded border border-(--color-border) bg-white px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setHoldMs((v) => clampMs(v + MS_STEP, DEFAULT_HOLD_MS))}
                  className="rounded px-2 py-1 text-sm admin-btn"
                >
                  +
                </button>
              </span>
            </label>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-(--color-border) px-4 py-3">
          {editingId && (
            <button
              type="button"
              onClick={() => void removeGroup()}
              disabled={busy}
              className="mr-auto rounded px-3 py-1.5 text-sm btn-negative disabled:opacity-50"
            >
              Delete transition
            </button>
          )}
          <button type="button" onClick={onClose} className="rounded px-3 py-1.5 text-sm admin-btn">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={!canSave || busy}
            title={canSave ? undefined : `Pick ${TRANSITION_MIN_MEMBERS}–${TRANSITION_MAX_MEMBERS} images for a transition`}
            className="rounded px-3 py-1.5 text-sm btn-positive disabled:opacity-50"
          >
            {busy ? "Saving…" : editingId ? "Save transition" : "Create transition"}
          </button>
        </div>
      </div>
    </div>
  );
}
