"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import type { FolderData } from "./types";

/**
 * Searchable folder picker showing project thumbnails, so a folder can be identified by its
 * project photo rather than by name alone. Optionally creates a folder inline.
 */
export default function FolderPicker({
  folders,
  value,
  onChange,
  allowCreate = false,
  onCreate,
  emptyLabel = "No folders yet — create the first one.",
  columnsClassName = "grid-cols-2 sm:grid-cols-3",
  maxHeightClassName = "max-h-72 overflow-y-auto",
}: {
  folders: FolderData[];
  value: string | null;
  onChange: (slug: string | null) => void;
  allowCreate?: boolean;
  onCreate?: (name: string, hidden: boolean) => Promise<FolderData | null>;
  emptyLabel?: string;
  /** Tailwind grid-column classes for the card grid (defaults suit the upload modal). */
  columnsClassName?: string;
  /** Wrapper scroll cap. Pass "" when the surrounding dialog already scrolls. */
  maxHeightClassName?: string;
}) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [hideNew, setHideNew] = useState(false);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return folders;
    return folders.filter((folder) => folder.name.toLowerCase().includes(q));
  }, [folders, query]);

  async function submitNew() {
    if (!onCreate) return;
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    const created = await onCreate(name, hideNew);
    setBusy(false);
    if (created) {
      setNewName("");
      setHideNew(false);
      setCreating(false);
      onChange(created.slug);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search folders…"
          className="flex-1 rounded border bg-white px-2 py-1.5 text-sm"
        />
        {allowCreate && (
          <button
            type="button"
            onClick={() => setCreating((open) => !open)}
            className={`rounded px-3 py-1.5 text-sm ${creating ? "admin-btn" : "btn-positive"}`}
          >
            {creating ? "Cancel" : "＋ New folder"}
          </button>
        )}
      </div>

      {creating && (
        <div className="rounded border p-3 space-y-2 bg-white">
          <div className="flex items-center gap-2">
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Folder name (project address)"
              className="flex-1 rounded border px-2 py-1.5 text-sm"
              onKeyDown={(event) => {
                if (event.key === "Enter") void submitNew();
              }}
            />
            <button
              type="button"
              disabled={busy || !newName.trim()}
              onClick={submitNew}
              className={`rounded px-3 py-1.5 text-sm ${busy || !newName.trim() ? "bg-gray-500 cursor-not-allowed text-white" : "btn-positive"}`}
            >
              {busy ? "Creating…" : "Create"}
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={hideNew} onChange={(event) => setHideNew(event.target.checked)} />
            Hide this folder from /projects
          </label>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-600">{folders.length === 0 ? emptyLabel : "No folders match that search."}</p>
      ) : (
        <div className={`grid gap-3 pr-1 ${columnsClassName} ${maxHeightClassName}`.trim()}>
          {filtered.map((folder) => {
            const selected = value === folder.slug;
            return (
              <button
                key={folder.id}
                type="button"
                onClick={() => onChange(selected ? null : folder.slug)}
                className={`text-left rounded-lg overflow-hidden border transition-shadow ${
                  selected ? "border-2 border-(--btn-select) shadow-md" : "border-(--color-border) hover:shadow-md"
                }`}
                aria-pressed={selected}
              >
                <div className="relative aspect-video w-full bg-(--color-bg-secondary)">
                  {folder.coverUrl ? (
                    <Image
                      src={folder.coverUrl}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 240px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-xs text-gray-500">
                      {folder.assetCount === 0 ? "empty" : "no cover"}
                    </span>
                  )}
                  {folder.hidden && (
                    <span className="absolute top-1 right-1 text-[10px] uppercase tracking-wide bg-black/70 text-white px-1.5 py-0.5 rounded">
                      hidden
                    </span>
                  )}
                </div>
                <div className="px-2 py-1.5 bg-white">
                  <div className="text-sm font-medium truncate" title={folder.name}>
                    {folder.name}
                  </div>
                  <div className="text-xs text-gray-500">{folder.assetCount} file{folder.assetCount === 1 ? "" : "s"}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
