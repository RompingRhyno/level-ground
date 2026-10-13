"use client";

import { useState } from "react";
import Image from "next/image";
import { getLayoutCells, getCellSizes } from "@/lib/gallery-layout";
import type { ResolvedTransition } from "@/lib/transition";
import TransitionTile from "./TransitionTile";
import GalleryLightbox, { type LightboxProject } from "./GalleryLightbox";

import type { GalleryLayout } from "@/types/sections";

type Asset = { id: string; publicUrl: string; alt: string | null };

export default function GalleryClient({
  assets,
  transitions = {},
  projects = {},
  showProjectLink = true,
  layoutMode = "bento",
  seeMore = null,
}: {
  assets: Asset[];
  transitions?: Record<string, ResolvedTransition>;
  projects?: Record<string, LightboxProject>;
  showProjectLink?: boolean;
  layoutMode?: GalleryLayout;
  /** Resolved collapse settings; null = show everything (the default). */
  seeMore?: { text?: string; cutoff?: number } | null;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  const prev = () => setOpen((i) => (i !== null ? (i > 0 ? i - 1 : assets.length - 1) : null));
  const next = () => setOpen((i) => (i !== null ? (i < assets.length - 1 ? i + 1 : 0) : null));

  const cutoff = seeMore?.cutoff && seeMore.cutoff > 0 ? seeMore.cutoff : 6;
  const collapsed = !!seeMore && !expanded && assets.length > cutoff;
  const shownAssets = collapsed ? assets.slice(0, cutoff) : assets;
  // The visible cells are the FULL pattern's first N, so revealing the rest continues the same
  // layout rather than starting a second pattern — that is what keeps the expansion seamless.
  const cells = getLayoutCells(assets.length, layoutMode).filter((c) => !collapsed || c.assetIndex < cutoff);
  return (
    <>
      {/* Mobile: simple 1–2 col responsive grid. Inset 24px each side to match the collection index's card
          grid, so every tile carries the same corner radius — no tile touches the screen edge any more. */}
      <div className="md:hidden grid grid-cols-1 sm:grid-cols-2 gap-1.5 px-6">
        {shownAssets.map((asset, i) => (
          <button
            key={asset.id}
            className="group relative aspect-video w-full overflow-hidden cursor-pointer rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            onClick={() => setOpen(i)}
            aria-label={asset.alt ?? `Image ${i + 1}`}
          >
            {transitions[asset.id] ? (
              <TransitionTile
                members={transitions[asset.id].members}
                transition={transitions[asset.id].transition}
                sizes="(min-width:640px) 50vw, 100vw"
                quality={85}
                showPills={false}
              />
            ) : (
              <Image
                src={asset.publicUrl}
                alt={asset.alt ?? ""}
                fill
                sizes="(min-width:640px) 50vw, 100vw"
                quality={85}
                className="object-cover will-change-transform transition-transform duration-[1000ms] group-hover:[transform:scale(1.03)]"
                loading="lazy"
              />
            )}
          </button>
        ))}
      </div>

      {/* Desktop: bento/grid layout engine — six columns, same as Gallery.tsx. Inset 24px each side, like
          the mobile grid, so corners are uniform; hover is a subtle zoom clipped by the tile's own
          overflow, not an opacity overlay. */}
      <div className="hidden md:grid md:grid-cols-6 gap-1.5 px-6">
        {cells.map((cell) => {
          const asset = assets[cell.assetIndex];
          const group = transitions[asset.id];
          return (
            <button
              key={asset.id}
              style={{
                gridColumn: `${cell.colStart} / span ${cell.colSpan}`,
                gridRow: `${cell.rowStart} / span ${cell.rowSpan}`,
              }}
              className={`group relative rounded-2xl overflow-hidden cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white${
                cell.cellType !== "bento-large" ? " aspect-video" : ""
              }`}
              onClick={() => setOpen(cell.assetIndex)}
              aria-label={asset.alt ?? `Image ${cell.assetIndex + 1}`}
            >
              {group ? (
                <TransitionTile
                  members={group.members}
                  transition={group.transition}
                  sizes={getCellSizes(cell.cellType, cell.colSpan)}
                  quality={cell.cellType === "small" ? 85 : 95}
                />
              ) : (
                <Image
                  src={asset.publicUrl}
                  alt={asset.alt ?? ""}
                  fill
                  sizes={getCellSizes(cell.cellType, cell.colSpan)}
                  quality={cell.cellType === "small" ? 85 : 95}
                  className="object-cover will-change-transform transition-transform duration-[1000ms] group-hover:[transform:scale(1.03)]"
                  loading="lazy"
                />
              )}
            </button>
          );
        })}
      </div>

      {collapsed && (
        <div className="mt-4 flex justify-center px-6">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="px-5 py-2 rounded-full text-base font-medium transition-colors border border-(--tag-border-color) bg-(--btn-primary-bg) text-(--btn-primary-text) hover:bg-(--btn-select) hover:text-(--btn-select-text)"
          >
            {seeMore?.text?.trim() || "See more"}
          </button>
        </div>
      )}

      <GalleryLightbox
        assets={assets}
        transitions={transitions}
        projects={projects}
        showProjectLink={showProjectLink}
        openIndex={open}
        onClose={() => setOpen(null)}
        onGotoIndex={setOpen}
        onPrev={prev}
        onNext={next}
      />
    </>
  );
}
