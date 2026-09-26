"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Menu from "./Menu";
import type { FolderData } from "./types";

const FolderIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

/**
 * Project folder card — the /projects listing card treatment (bordered card, 16:9 cover,
 * label bar that inverts on hover) plus admin affordances: asset count, hidden badge,
 * drop-to-upload, kebab actions and a reorder drag handle.
 *
 * The whole card opens the folder; nested controls stop propagation so they act locally.
 */
export default function FolderCard({
  folder,
  onOpen,
  onRename,
  onToggleHidden,
  onDelete,
  onDropFiles,
  onAddFiles,
  dragging,
  dropTarget,
  onReorderDragStart,
  onReorderDragOver,
  onReorderDrop,
  onReorderDragEnd,
}: {
  folder: FolderData;
  onOpen: () => void;
  onRename: (name: string) => Promise<void>;
  onToggleHidden: () => Promise<void>;
  onDelete: () => void;
  onDropFiles: (files: File[]) => void;
  onAddFiles: () => void;
  dragging?: boolean;
  dropTarget?: boolean;
  onReorderDragStart: (event: React.DragEvent) => void;
  onReorderDragOver: (event: React.DragEvent) => void;
  onReorderDrop: (event: React.DragEvent) => void;
  onReorderDragEnd: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folder.name);
  const [saving, setSaving] = useState(false);
  const [fileDragOver, setFileDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function open() {
    if (editing) return;
    onOpen();
  }

  async function save() {
    const next = name.trim();
    if (!next || next === folder.name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    await onRename(next);
    setSaving(false);
    setEditing(false);
  }

  return (
    <div
      draggable={!editing}
      onDragStart={onReorderDragStart}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) return;
        onReorderDragOver(event);
      }}
      onDrop={(event) => {
        if (event.dataTransfer.types.includes("Files")) return;
        onReorderDrop(event);
      }}
      onDragEnd={onReorderDragEnd}
      data-folder-slug={folder.slug}
      onClick={open}
      onKeyDown={(event) => {
        if (editing) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      }}
      role="link"
      tabIndex={0}
      aria-label={`Open folder ${folder.name}`}
      className={`group relative rounded-lg overflow-hidden border bg-white transition-shadow cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-(--btn-select) ${
        dropTarget ? "ring-2 ring-(--btn-select)" : "border-(--color-border) hover:shadow-md"
      } ${dragging ? "opacity-50" : ""} ${fileDragOver ? "ring-2 ring-(--btn-positive-bg)" : ""}`}
      onDragEnter={(event) => {
        if (event.dataTransfer.types.includes("Files")) setFileDragOver(true);
      }}
      onDragLeave={() => setFileDragOver(false)}
      onDragOverCapture={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }
      }}
      onDropCapture={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        event.stopPropagation();
        setFileDragOver(false);
        onDropFiles(Array.from(event.dataTransfer.files));
      }}
    >
      <div className="relative aspect-video w-full">
        {folder.coverUrl ? (
          <Image
            src={folder.coverUrl}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-(--color-bg-secondary) flex items-center justify-center text-xs text-gray-500">
            {folder.assetCount === 0 ? "Empty folder" : "No cover yet"}
          </div>
        )}

        {/* Controls / status */}
        <div className="absolute inset-0 flex flex-col justify-between p-2">
          <div className="flex items-start justify-between gap-1">
            <span className="inline-flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white">
              <FolderIcon />
              {folder.assetCount} file{folder.assetCount === 1 ? "" : "s"}
            </span>
            {folder.hidden && (
              <span className="rounded bg-black/70 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white">
                hidden
              </span>
            )}
          </div>

          <div className="flex items-end justify-between gap-1">
            {folder.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {folder.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="text-[11px] px-1.5 py-0.5 rounded-full bg-black/60 text-white">
                    {tag.replace(/-/g, " ")}
                  </span>
                ))}
              </div>
            ) : (
              <span />
            )}
            <span className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 has-[button[aria-expanded=true]]:opacity-100">
              <Menu
                buttonClassName="rounded bg-black/60 px-1.5 py-1 text-white hover:bg-black/75"
                items={[
                  {
                    label: "Add files…",
                    onSelect: onAddFiles,
                  },
                  {
                    label: folder.hidden ? "Show on /projects" : "Hide from /projects",
                    onSelect: () => void onToggleHidden(),
                  },
                  {
                    label: "Rename",
                    onSelect: () => {
                      setName(folder.name);
                      setEditing(true);
                    },
                  },
                  { label: "Delete folder…", danger: true, onSelect: onDelete },
                ]}
              />
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 bg-white transition-colors duration-200 group-hover:bg-(--color-brand-dark)">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              value={name}
              onChange={(event) => setName(event.target.value)}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Enter") void save();
                if (event.key === "Escape") setEditing(false);
              }}
              className="flex-1 rounded border px-2 py-1 text-sm text-(--color-brand-dark) bg-white"
              aria-label="Folder name"
            />
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                void save();
              }}
              disabled={saving}
              className={`rounded px-2 py-1 text-xs text-white ${saving ? "bg-gray-500" : "btn-positive"}`}
            >
              {saving ? "…" : "Save"}
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setEditing(false);
              }}
              className="rounded px-2 py-1 text-xs admin-btn"
            >
              Cancel
            </button>
            <span className="hidden text-[11px] text-gray-500 sm:block">Renaming updates the project URL</span>
          </div>
        ) : (
          <h3
            className="truncate text-lg font-medium transition-colors duration-200 group-hover:text-white"
            title={folder.name}
          >
            {folder.name}
          </h3>
        )}
      </div>
    </div>
  );
}
