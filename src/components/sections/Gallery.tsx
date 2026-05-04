import Image from "next/image";
import type { Prisma } from "@prisma/client";
import { GallerySection } from "@/types/sections";
import { prisma } from "@/lib/prisma";
import GalleryClient from "./GalleryClient";

type AssetRow = { id: string; publicUrl: string | null; alt: string | null };

async function fetchAssets(section: GallerySection): Promise<AssetRow[]> {
  if (section.mode === "static") {
    const rows = await prisma.asset.findMany({
      where: { id: { in: section.assetIds } },
      select: { id: true, publicUrl: true, alt: true },
    });
    const order = new Map(section.assetIds.map((id, i) => [id, i]));
    return rows.sort((a: AssetRow, b: AssetRow) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }

  const where: Prisma.AssetWhereInput = {};
  if (section.filters.tags?.length) where.tags = { hasSome: section.filters.tags };
  if (section.filters.folder) where.folder = section.filters.folder;

  return prisma.asset.findMany({
    where,
    select: { id: true, publicUrl: true, alt: true },
    orderBy: { createdAt: "desc" },
  });
}

function SectionHeader({ heading, body }: { heading?: string; body?: string }) {
  if (!heading && !body) return null;
  return (
    <div className="max-w-7xl mx-auto px-4 mb-8">
      {heading && (
        <h2
          className="heading text-3xl sm:text-3xl md:text-5xl font-light leading-tight mb-6"
          dangerouslySetInnerHTML={{ __html: heading }}
          style={{ color: "var(--color-text-heading)" }}
        />
      )}

      {body && (
        <p
          className="mt-4 max-w-3xl text-left"
          style={{ color: "var(--color-text-primary)" }}
        >
          {body}
        </p>
      )}
    </div>
  );
}

export default async function Gallery(section: GallerySection) {
  const assets = await fetchAssets(section);
  const valid = assets.filter(
    (a): a is AssetRow & { publicUrl: string } => !!a.publicUrl
  );

  const layout = section.layout ?? "grid";

  if (section.lightbox) {
    return (
      <section className="py-12">
        <SectionHeader heading={section.heading} body={section.body} />
        <GalleryClient assets={valid} />
      </section>
    );
  }

  if (layout === "masonry") {
    return (
      <section className="py-12">
        <SectionHeader heading={section.heading} body={section.body} />
        <div className="max-w-7xl mx-auto px-4 columns-1 sm:columns-2 md:columns-3 gap-4">
          {valid.map((asset) => (
            <div key={asset.id} className="break-inside-avoid mb-4 rounded overflow-hidden">
              <Image
                src={asset.publicUrl}
                alt={asset.alt ?? ""}
                width={800}
                height={600}
                sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"
                className="w-full h-auto object-cover"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="py-12">
      <SectionHeader heading={section.heading} body={section.body} />
      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 px-4">
        {valid.map((asset) => (
          <div key={asset.id} className="relative h-64 w-full rounded overflow-hidden">
            <Image
              src={asset.publicUrl}
              alt={asset.alt ?? ""}
              fill
              sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"
              className="object-cover"
              loading="lazy"
            />
          </div>
        ))}
      </div>
    </section>
  );
}

