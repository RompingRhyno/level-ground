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

function StaticGrid({ assets, layout }: { assets: Asset[]; layout: GalleryLayout }) {
  if (layout === "masonry") {
    return (
      <div className="max-w-7xl mx-auto px-4 columns-1 sm:columns-2 md:columns-3 gap-4">
        {assets.map((a) => (
          <div key={a.id} className="break-inside-avoid mb-4 rounded overflow-hidden">
            <Image
              src={a.publicUrl}
              alt={a.alt ?? ""}
              width={800}
              height={600}
              className="w-full object-cover"
              loading="lazy"
            />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 px-4">
      {assets.map((a) => (
        <div key={a.id} className="relative aspect-video rounded overflow-hidden">
          <Image src={a.publicUrl} alt={a.alt ?? ""} fill className="object-cover" loading="lazy" />
        </div>
      ))}
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
      <h1
        className="heading text-3xl sm:text-4xl md:text-5xl font-light leading-tight mb-6"
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
                className="text-sm px-3 py-1 rounded-full border border-[var(--tag-border-color)] bg-(--btn-primary-bg) text-(--btn-primary-text) hover:bg-(--btn-select) hover:text-(--btn-select-text)"
              >
                {tag.name}
              </Link>
            ) : (
              <span key={tag.slug} className="text-sm px-3 py-1 rounded-full border border-[var(--tag-border-color)] bg-(--btn-primary-bg) text-(--btn-primary-text)">
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
