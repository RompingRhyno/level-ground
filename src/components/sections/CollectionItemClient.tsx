"use client";

import Image from "next/image";
import Link from "next/link";
import GalleryClient from "./GalleryClient";
import type { GalleryLayout } from "@/types/sections";

type Asset = { id: string; publicUrl: string; alt: string | null };

type TagRow = { slug: string; name: string };

type Props = {
  name: string;
  description?: string | null;
  displayTags: TagRow[];
  collectionSlug?: string | null;
  assets: Asset[];
  layout: GalleryLayout;
  lightbox: boolean;
};

// Full-bleed tiles with a 16px gutter, like Gallery.tsx. Every image needs its own `sizes`: without one
// next/image assumes 100vw and the browser fetches the largest candidate for a third-width tile.
const TILE_SIZES = "(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw";

function StaticGrid({ assets, layout }: { assets: Asset[]; layout: GalleryLayout }) {
  if (layout === "masonry") {
    // Rounded throughout: which column an item lands in is the browser's column balancing, so an item
    // cannot know whether it sits on the screen edge.
    return (
      <div className="w-full columns-1 sm:columns-2 md:columns-3 gap-2">
        {assets.map((a) => (
          <div key={a.id} className="break-inside-avoid mb-2 rounded overflow-hidden">
            <Image
              src={a.publicUrl}
              alt={a.alt ?? ""}
              width={800}
              height={600}
              sizes={TILE_SIZES}
              quality={85}
              className="w-full object-cover"
              loading="lazy"
            />
          </div>
        ))}
      </div>
    );
  }
  // 1 / 2 / 3 columns of a full-bleed row, so the corner that sits on a screen edge is square at each
  // breakpoint: at one column a tile touches both edges, at two the left tile squares its left pair and
  // the right tile its right pair, and at three the same logic applies to first/middle/last.
  return (
    <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
      {assets.map((a, i) => {
        const sm = i % 2 === 0 ? "sm:rounded-r" : "sm:rounded-l";
        const md =
          i % 3 === 0
            ? "md:rounded-r"
            : i % 3 === 1
              ? "md:rounded"
              : "md:rounded-l md:rounded-r-none";
        return (
          <div key={a.id} className={`relative aspect-video overflow-hidden rounded-none ${sm} ${md}`}>
            <Image
              src={a.publicUrl}
              alt={a.alt ?? ""}
              fill
              sizes={TILE_SIZES}
              quality={85}
              className="object-cover"
              loading="lazy"
            />
          </div>
        );
      })}
    </div>
  );
}

export default function CollectionItemClient({
  name,
  description,
  displayTags,
  collectionSlug,
  assets,
  layout,
  lightbox,
}: Props) {
  return (
    <div>
      {/* Text carries its own padding — the section wrapper is full-bleed with no edge inset — while the
          media grids below run flush to the edges. */}
      <div className="px-4 md:px-8">
        <h1
          className="heading max-w-4xl text-3xl sm:text-4xl md:text-5xl font-light leading-tight mb-6"
          style={{ color: "var(--color-text-heading)" }}
        >
          {name}
        </h1>

        {displayTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {displayTags.map((tag) =>
              collectionSlug ? (
                <Link
                  key={tag.slug}
                  href={`/${collectionSlug}?tag=${encodeURIComponent(tag.slug)}`}
                  className="text-sm px-3 py-1 rounded-full border border-(--tag-border-color) bg-(--btn-primary-bg) text-(--btn-primary-text) hover:bg-(--btn-select) hover:text-(--btn-select-text)"
                >
                  {tag.name}
                </Link>
              ) : (
                <span key={tag.slug} className="text-sm px-3 py-1 rounded-full border border-(--tag-border-color) bg-(--btn-primary-bg) text-(--btn-primary-text)">
                  {tag.name}
                </span>
              )
            )}
          </div>
        )}

        {description && (
          <p className="mb-10 max-w-3xl" style={{ color: "var(--color-text-primary)" }}>
            {description}
          </p>
        )}
      </div>

      {assets.length > 0 && (
        lightbox ? (
          <GalleryClient assets={assets} layoutMode={layout} />
        ) : (
          <StaticGrid assets={assets} layout={layout} />
        )
      )}
    </div>
  );
}
