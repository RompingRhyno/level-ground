"use client";

import Image from "next/image";
import Menu from "./Menu";
import TransitionTile from "@/components/sections/TransitionTile";
import { filenameExt, filenameStem, formatBytes, isVideoAsset, tileThumb, type AssetData } from "./types";
import type { ResolvedTransition } from "@/lib/transition";

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
 *
 * A transition group (a row whose meta carries `transition`) is rendered by the same tile component the
 * galleries use, so the card shows the transition as configured, and its kebab offers Edit transition instead
 * of rename/alt — those fields are generated.
 */
export default function AssetTile({
  asset,
  group,
  selected,
  usage,
  onToggleSelect,
  onOpen,
  onRename,
  onSetAlt,
  onMove,
  onDelete,
  onEditTransition,
  dragging,
  dropTarget,
  onReorderDragStart,
  onReorderDragOver,
  onReorderDrop,
  onReorderDragEnd,
}: {
  asset: AssetData;
  group?: ResolvedTransition;
  selected: boolean;
  usage: string[];
  onToggleSelect: () => void;
  onOpen: () => void;
  onRename: () => void;
  onSetAlt: () => void;
  onMove: () => void;
  onDelete: () => void;
  onEditTransition?: () => void;
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
        selected
          ? "border-(--media-select-color) ring-2 ring-(--media-select-color)"
          : dropTarget
            ? "ring-2 ring-(--btn-select)"
            : "border-(--color-border) hover:shadow-md"
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
        {group ? (
          <TransitionTile
            members={group.members}
            transition={group.transition}
            sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 384px"
            quality={75}
          />
        ) : thumb ? (
          <Image
            src={thumb}
            alt={asset.alt ?? ""}
            fill
            sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 384px"
            className="object-cover"
          />
        ) : video && asset.publicUrl ? (
          // Posterless video (e.g. uploaded outside the media admin): let the browser paint a
          // frame, seeking to 1s via a media fragment where the format supports it.
          <video
            src={`${asset.publicUrl}#t=1`}
            className="absolute inset-0 h-full w-full object-cover"
            preload="metadata"
            muted
            playsInline
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-(--color-text-light)">
            <DocumentIcon />
            <span className="text-[11px] uppercase tracking-wide">{(filenameExt(asset) || ".file").replace(".", "")}</span>
          </div>
        )}

        {video && <PlayBadge />}

        {/* Actions */}
        <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 has-[button[aria-expanded=true]]:opacity-100">
          <Menu
            buttonClassName="rounded bg-white/90 p-1 shadow hover:bg-white"
            items={
              group
                ? [
                    ...(onEditTransition ? [{ label: "Edit transition…", onSelect: onEditTransition }] : []),
                    { label: "Move to folder…", onSelect: onMove },
                    { label: "Delete…", danger: true, onSelect: onDelete },
                  ]
                : [
                    { label: "Rename…", onSelect: onRename },
                    { label: asset.alt ? "Edit alt text…" : "Set alt text…", onSelect: onSetAlt },
                    { label: "Move to folder…", onSelect: onMove },
                    { label: "Delete…", danger: true, onSelect: onDelete },
                  ]
            }
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
            {group ? asset.filename : (
              <>
                {filenameStem(asset) || asset.filename}
                <span className="text-(--color-text-light)">{filenameExt(asset)}</span>
              </>
            )}
          </span>
          <span className="block text-[11px] text-(--color-text-light)">
            {group
              ? `${group.members.length} images · transition`
              : (
                <>
                  {formatBytes(asset.size)}
                  {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ""}
                  {video ? " · video" : ""}
                </>
              )}
          </span>
        </span>
      </label>
    </div>
  );
}
