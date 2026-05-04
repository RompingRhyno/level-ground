"use client";

import { useState } from "react";
import Image from "next/image";
import GalleryLightbox from "./GalleryLightbox";

type Asset = { id: string; publicUrl: string; alt: string | null };

export default function GalleryClient({ assets }: { assets: Asset[] }) {
  const [open, setOpen] = useState<number | null>(null);

  const prev = () => setOpen((i) => (i !== null ? (i > 0 ? i - 1 : assets.length - 1) : null));
  const next = () => setOpen((i) => (i !== null ? (i < assets.length - 1 ? i + 1 : 0) : null));

  return (
    <>
      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 px-4">
        {assets.map((asset, i) => (
          <button
            key={asset.id}
            className="relative h-64 w-full rounded overflow-hidden cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            onClick={() => setOpen(i)}
            aria-label={asset.alt ?? `Image ${i + 1}`}
          >
            <Image
              src={asset.publicUrl}
              alt={asset.alt ?? ""}
              fill
              sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"
              className="object-cover transition-opacity hover:opacity-90"
              loading="lazy"
            />
          </button>
        ))}
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
