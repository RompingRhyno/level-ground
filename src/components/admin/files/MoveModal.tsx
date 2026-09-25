"use client";

import { useEffect, useState } from "react";
import { api } from "./api";
import type { FolderData } from "./types";
import FolderPicker from "./FolderPicker";
import { useToast } from "./Toast";

/**
 * Move the current selection to another folder. Folders are shown as thumbnails because the
 * project address alone is not always enough to identify a job.
 */
export default function MoveModal({
  open,
  assetIds,
  folders,
  fromFolder,
  onClose,
  onMoved,
  onFolderCreated,
}: {
  open: boolean;
  assetIds: string[];
  folders: FolderData[];
  fromFolder?: string | null;
  onClose: () => void;
  onMoved: (count: number, target: FolderData) => void;
  onFolderCreated?: (folder: FolderData) => void;
}) {
  const toast = useToast();
  const [target, setTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setTarget(null);
  }, [open]);

  async function handleCreate(name: string, hidden: boolean): Promise<FolderData | null> {
    try {
      const created = await api<FolderData>("/api/folders", {
        method: "POST",
        body: JSON.stringify({ name, hidden }),
      });
      const withCounts: FolderData = { ...created, assetCount: 0, coverUrl: null };
      onFolderCreated?.(withCounts);
      return withCounts;
    } catch (err: any) {
      toast({ kind: "error", message: "Could not create folder", detail: err?.message });
      return null;
    }
  }

  async function move() {
    if (!target) return;
    const destination = folders.find((folder) => folder.slug === target);
    if (fromFolder && target === fromFolder) {
      toast({ kind: "info", message: "Those files are already in that folder" });
      return;
    }
    setBusy(true);
    try {
      await api("/api/assets/batch-move", {
        method: "POST",
        body: JSON.stringify({ ids: assetIds, folder: target }),
      });
      toast({
        kind: "success",
        message: `Moved ${assetIds.length} file${assetIds.length === 1 ? "" : "s"}${destination ? ` to ${destination.name}` : ""}`,
      });
      onMoved(assetIds.length, destination as FolderData);
      onClose();
    } catch (err: any) {
      toast({ kind: "error", message: "Move failed", detail: err?.message });
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Move files"
    >
      <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="font-semibold text-gray-800">
              Move {assetIds.length} file{assetIds.length === 1 ? "" : "s"}
            </h2>
            <p className="text-xs text-gray-500">Pick the destination project folder.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="text-xl leading-none text-gray-400 hover:text-gray-600 disabled:opacity-40"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4">
          <FolderPicker
            folders={folders.filter((folder) => folder.slug !== fromFolder)}
            value={target}
            onChange={setTarget}
            allowCreate
            onCreate={handleCreate}
          />
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
          <button type="button" onClick={onClose} disabled={busy} className="rounded px-4 py-1.5 text-sm admin-btn disabled:opacity-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={move}
            disabled={busy || !target}
            className={`rounded px-4 py-1.5 text-sm ${busy || !target ? "bg-gray-500 cursor-not-allowed text-white" : "btn-positive"}`}
          >
            {busy ? "Moving…" : "Move files"}
          </button>
        </div>
      </div>
    </div>
  );
}
