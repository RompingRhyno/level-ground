"use client";

import { useState } from "react";
import Image from "next/image";
import { getLayoutCells, getCellSizes, edgeCornerClasses } from "@/lib/gallery-layout";
import GalleryLightbox from "./GalleryLightbox";

import type { GalleryLayout } from "@/types/sections";

type Asset = { id: string; publicUrl: string; alt: string | null };

export default function GalleryClient({ assets, layoutMode = "bento" }: { assets: Asset[]; layoutMode?: GalleryLayout }) {
  const [open, setOpen] = useState<number | null>(null);

  const prev = () => setOpen((i) => (i !== null ? (i > 0 ? i - 1 : assets.length - 1) : null));
  const next = () => setOpen((i) => (i !== null ? (i < assets.length - 1 ? i + 1 : 0) : null));

  const cells = getLayoutCells(assets.length, layoutMode);

  return (
    <>
      {/* Mobile: simple 1–2 col responsive grid. Full bleed, so at one column a tile touches both edges
          (all corners square) and at two columns the left tile squares its left pair, the right tile its
          right pair. */}
      <div className="md:hidden grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {assets.map((asset, i) => (
          <button
            key={asset.id}
            className={`group relative aspect-video w-full overflow-hidden cursor-pointer rounded-none focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${
              i % 2 === 0 ? "sm:rounded-r" : "sm:rounded-l"
            }`}
            onClick={() => setOpen(i)}
            aria-label={asset.alt ?? `Image ${i + 1}`}
          >
            <Image
              src={asset.publicUrl}
              alt={asset.alt ?? ""}
              fill
              sizes="(min-width:640px) 50vw, 100vw"
              quality={85}
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          </button>
        ))}
      </div>

      {/* Desktop: bento/grid layout engine — six columns, same as Gallery.tsx. Corners on the screen edge
          are square (edgeCornerClasses); the rest stay rounded. Hover is a subtle zoom clipped by the
          tile's own overflow, not an opacity overlay. */}
      <div className="hidden md:grid md:grid-cols-6 gap-1.5">
        {cells.map((cell) => {
          const asset = assets[cell.assetIndex];
          return (
            <button
              key={asset.id}
              style={{
                gridColumn: `${cell.colStart} / span ${cell.colSpan}`,
                gridRow: `${cell.rowStart} / span ${cell.rowSpan}`,
              }}
              className={`group relative rounded overflow-hidden cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${edgeCornerClasses(
                cell.colStart,
                cell.colSpan,
              )}${cell.cellType !== "bento-large" ? " aspect-video" : ""}`}
              onClick={() => setOpen(cell.assetIndex)}
              aria-label={asset.alt ?? `Image ${cell.assetIndex + 1}`}
            >
              <Image
                src={asset.publicUrl}
                alt={asset.alt ?? ""}
                fill
                sizes={getCellSizes(cell.cellType, cell.colSpan)}
                quality={cell.cellType === "small" ? 85 : 95}
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
            </button>
          );
        })}
      </div>

      <GalleryLightbox
        assets={assets}
        openIndex={open}
        onClose={() => setOpen(null)}
        onGotoIndex={setOpen}
        onPrev={prev}
        onNext={next}
      />
    </>
  );
}
