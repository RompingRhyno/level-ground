"use client";

import { useState } from "react";
import Image from "next/image";
import { getLayoutCells, getCellSizes } from "@/lib/gallery-layout";
import GalleryLightbox from "./GalleryLightbox";

type Asset = { id: string; publicUrl: string; alt: string | null };

export default function GalleryClient({ assets, layoutMode = "bento" }: { assets: Asset[]; layoutMode?: "bento" | "grid" }) {
  const [open, setOpen] = useState<number | null>(null);

  const prev = () => setOpen((i) => (i !== null ? (i > 0 ? i - 1 : assets.length - 1) : null));
  const next = () => setOpen((i) => (i !== null ? (i < assets.length - 1 ? i + 1 : 0) : null));

  const cells = getLayoutCells(assets.length, layoutMode);

  return (
    <>
      {/* Mobile: simple 1–2 col responsive grid */}
      <div className="md:hidden max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4 px-4">
        {assets.map((asset, i) => (
          <button
            key={asset.id}
            className="relative aspect-video w-full rounded overflow-hidden cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            onClick={() => setOpen(i)}
            aria-label={asset.alt ?? `Image ${i + 1}`}
          >
            <Image
              src={asset.publicUrl}
              alt={asset.alt ?? ""}
              fill
              sizes="(min-width:640px) 50vw, 100vw"
              className="object-cover transition-opacity hover:opacity-90"
              loading="lazy"
            />
          </button>
        ))}
      </div>

      {/* Desktop: bento/grid layout engine */}
      <div className="hidden md:grid md:grid-cols-3 gap-4 max-w-7xl mx-auto px-4">
        {cells.map((cell) => {
          const asset = assets[cell.assetIndex];
          return (
            <button
              key={asset.id}
              style={{
                gridColumn: `${cell.colStart} / span ${cell.colSpan}`,
                gridRow: `${cell.rowStart} / span ${cell.rowSpan}`,
              }}
              className={`relative rounded overflow-hidden cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white${
                cell.cellType !== "bento-large" ? " aspect-video" : ""
              }`}
              onClick={() => setOpen(cell.assetIndex)}
              aria-label={asset.alt ?? `Image ${cell.assetIndex + 1}`}
            >
              <Image
                src={asset.publicUrl}
                alt={asset.alt ?? ""}
                fill
                sizes={getCellSizes(cell.cellType)}
                className="object-cover transition-opacity hover:opacity-90"
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
