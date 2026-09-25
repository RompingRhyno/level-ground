"use client";

import Image from "next/image";
import Menu from "./Menu";
import { filenameExt, filenameStem, formatBytes, isVideoAsset, tileThumb, type AssetData } from "./types";

function DocumentIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function PlayBadge() {
  return (
    <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/70 p-1 text-white" aria-hidden="true">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
        <polygon points="6 3 20 12 6 21 6 3" />
      </svg>
    </span>
  );
}

/**
 * Asset tile.
 *
 * Click targets are deliberate:
 *   - the thumbnail opens the lightbox
 *   - the footer is a <label>, so clicking the file name (or the checkbox) toggles selection
 *   - the kebab holds Rename / Alt text / Move / Delete
 *
 * Videos show their captured poster (never a live <video> element — that would fetch video
 * headers for every tile) and are identified by a play badge.
 */
export default function AssetTile({
  asset,
  selected,
  usage,
  onToggleSelect,
  onOpen,
  onRename,
  onSetAlt,
  onMove,
  onDelete,
  dragging,
  dropTarget,
  onReorderDragStart,
  onReorderDragOver,
  onReorderDrop,
  onReorderDragEnd,
}: {
  asset: AssetData;
  selected: boolean;
  usage: string[];
  onToggleSelect: () => void;
  onOpen: () => void;
  onRename: () => void;
  onSetAlt: () => void;
  onMove: () => void;
  onDelete: () => void;
  dragging?: boolean;
  dropTarget?: boolean;
  onReorderDragStart?: (event: React.DragEvent) => void;
  onReorderDragOver?: (event: React.DragEvent) => void;
  onReorderDrop?: (event: React.DragEvent) => void;
  onReorderDragEnd?: () => void;
}) {
  const video = isVideoAsset(asset);
  const thumb = tileThumb(asset);

  return (
    <div
      draggable
      onDragStart={onReorderDragStart}
      onDragOver={onReorderDragOver}
      onDrop={onReorderDrop}
      onDragEnd={onReorderDragEnd}
      data-asset-id={asset.id}
      className={`group relative rounded-lg overflow-hidden border bg-white transition-shadow ${
        dropTarget ? "ring-2 ring-(--btn-select)" : "border-(--color-border) hover:shadow-md"
      } ${dragging ? "opacity-50" : ""}`}
    >
      {/* Thumbnail — opens the preview */}
      <div
        onClick={onOpen}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`Open ${asset.filename ?? "file"}`}
        className="relative aspect-video w-full cursor-pointer bg-(--color-bg-secondary) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--btn-select)"
      >
        {thumb ? (
          <Image
            src={thumb}
            alt={asset.alt ?? ""}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-gray-500">
            <DocumentIcon />
            <span className="text-[11px] uppercase tracking-wide">{(filenameExt(asset) || ".file").replace(".", "")}</span>
          </div>
        )}

        {video && <PlayBadge />}

        {selected && <div className="pointer-events-none absolute inset-0 ring-4 ring-inset ring-(--btn-select)" />}

        {/* Actions */}
        <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 has-[button[aria-expanded=true]]:opacity-100">
          <Menu
            buttonClassName="rounded bg-white/90 p-1 shadow hover:bg-white"
            items={[
              { label: "Rename…", onSelect: onRename },
              { label: asset.alt ? "Edit alt text…" : "Set alt text…", onSelect: onSetAlt },
              { label: "Move to folder…", onSelect: onMove },
              { label: "Delete…", danger: true, onSelect: onDelete },
            ]}
          />
        </div>

        {usage.length > 0 && (
          <span
            className="absolute bottom-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white"
            title={`Used on: ${usage.join(", ")}`}
          >
            used on {usage.length}
          </span>
        )}
      </div>

      {/* Footer — a label, so the name, the metadata and the checkbox all toggle selection */}
      <label
        className="flex cursor-pointer items-start gap-2 px-3 py-2"
        title={selected ? "Deselect" : "Select"}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="mt-0.5 h-4 w-4 accent-(--btn-select)"
          aria-label={`Select ${asset.filename ?? "file"}`}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-(--color-brand-dark)" title={asset.filename ?? ""}>
            {filenameStem(asset) || asset.filename}
            <span className="text-gray-400">{filenameExt(asset)}</span>
          </span>
          <span className="block text-[11px] text-gray-500">
            {formatBytes(asset.size)}
            {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ""}
            {video ? " · video" : ""}
          </span>
        </span>
      </label>
    </div>
  );
}
