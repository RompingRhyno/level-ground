import Image from "next/image";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { GallerySection } from "@/types/sections";
import { prisma } from "@/lib/prisma";
import { getLayoutCells, getCellSizes } from "@/lib/gallery-layout";
import GalleryClient from "./GalleryClient";

type AssetRow = { id: string; publicUrl: string | null; alt: string | null; folder: string | null };
type TagRow = { slug: string; name: string };

async function fetchAssets(section: GallerySection): Promise<AssetRow[]> {
  if (section.mode === "static") {
    const rows = await prisma.asset.findMany({
      where: { id: { in: section.assetIds } },
      select: { id: true, publicUrl: true, alt: true, folder: true },
    });
    const order = new Map(section.assetIds.map((id, i) => [id, i]));
    return rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }

  const where: Prisma.AssetWhereInput = {};
  const hasFolder = !!section.filters.folder;
  if (hasFolder) {
    where.folder = section.filters.folder;
  } else if (section.filters.tags?.length) {
    const taggedFolders = await prisma.folder.findMany({
      where: { tags: { hasSome: section.filters.tags } },
      select: { slug: true },
    });
    where.folder = { in: taggedFolders.map((f) => f.slug) };
  }

  return prisma.asset.findMany({
    where,
    select: { id: true, publicUrl: true, alt: true, folder: true },
    orderBy: hasFolder
      ? [{ orderIndex: "asc" }, { createdAt: "asc" }]
      : { createdAt: "desc" },
  });
}

async function resolveTags(section: GallerySection, assets: AssetRow[]): Promise<TagRow[]> {
  const td = section.tagDisplay;
  if (!td?.enabled) return [];

  if (td.mode === "manual" && td.tags?.length) {
    const tags = await prisma.tag.findMany({
      where: { slug: { in: td.tags } },
      select: { slug: true, name: true },
      orderBy: { name: "asc" },
    });
    return tags;
  }

  if (td.mode === "auto") {
    // Derive folders from rendered assets
    const folderSlugs = [...new Set(assets.map((a: any) => a.folder).filter(Boolean))] as string[];
    if (!folderSlugs.length) return [];

    const folders = await prisma.folder.findMany({
      where: { slug: { in: folderSlugs } },
      select: { tags: true },
    });

    const tagSlugs = [...new Set(folders.flatMap((f) => f.tags))];
    if (!tagSlugs.length) return [];

    const tags = await prisma.tag.findMany({
      where: { slug: { in: tagSlugs } },
      select: { slug: true, name: true },
      orderBy: { name: "asc" },
    });
    return tags;
  }

  return [];
}

async function findCollectionIndexPageSlug(): Promise<string | null> {
  const pages = await prisma.page.findMany({ select: { slug: true, sections: true } });
  for (const page of pages) {
    const sections = page.sections as any[];
    if (sections.some((s) => s.type === "collection-index")) {
      return page.slug;
    }
  }
  return null;
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

function TagPills({ tags, collectionSlug }: { tags: TagRow[]; collectionSlug: string | null }) {
  if (!tags.length) return null;
  return (
    <div className="max-w-7xl mx-auto px-4 mb-6 flex flex-wrap gap-2">
      {tags.map((tag) =>
        collectionSlug ? (
          <Link
            key={tag.slug}
            href={`/${collectionSlug}?tag=${encodeURIComponent(tag.slug)}`}
            className="admin-btn text-sm px-3 py-1 rounded-full"
          >
            {tag.name}
          </Link>
        ) : (
          <span key={tag.slug} className="admin-btn text-sm px-3 py-1 rounded-full">
            {tag.name}
          </span>
        )
      )}
    </div>
  );
}

export default async function Gallery(section: GallerySection) {
  const assets = await fetchAssets(section);
  const valid = assets.filter(
    (a): a is AssetRow & { publicUrl: string } => a.publicUrl !== null
  ) as (AssetRow & { publicUrl: string })[];

  const layout = section.layout ?? "grid";

  // Resolve display tags and collection-index page slug in parallel
  const [tags, collectionSlug] = await Promise.all([
    resolveTags(section, assets),
    section.tagDisplay?.enabled ? findCollectionIndexPageSlug() : Promise.resolve(null),
  ]);

  if (section.lightbox) {
    return (
      <section>
        <SectionHeader heading={section.heading} body={section.body} />
        <TagPills tags={tags} collectionSlug={collectionSlug} />
        <GalleryClient assets={valid} layoutMode={layout === "bento" ? "bento" : "grid"} />
      </section>
    );
  }

  if (layout === "masonry") {
    return (
      <section>
        <SectionHeader heading={section.heading} body={section.body} />
        <TagPills tags={tags} collectionSlug={collectionSlug} />
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

  // "bento" and "grid" both use the smart layout engine
  const cells = getLayoutCells(valid.length, layout === "bento" ? "bento" : "grid");

  return (
    <section>
      <SectionHeader heading={section.heading} body={section.body} />
      <TagPills tags={tags} collectionSlug={collectionSlug} />

      {/* Mobile: simple 1–2 col responsive grid */}
      <div className="md:hidden max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4 px-4">
        {valid.map((asset) => (
          <div key={asset.id} className="relative aspect-video w-full rounded overflow-hidden">
            <Image
              src={asset.publicUrl}
              alt={asset.alt ?? ""}
              fill
              sizes="(min-width:640px) 50vw, 100vw"
              className="object-cover"
              loading="lazy"
            />
          </div>
        ))}
      </div>

      {/* Desktop: bento/grid layout engine */}
      <div className="hidden md:grid md:grid-cols-3 gap-4 max-w-7xl mx-auto px-4">
        {cells.map((cell) => {
          const asset = valid[cell.assetIndex];
          return (
            <div
              key={asset.id}
              style={{
                gridColumn: `${cell.colStart} / span ${cell.colSpan}`,
                gridRow: `${cell.rowStart} / span ${cell.rowSpan}`,
              }}
              className={`relative rounded overflow-hidden${
                cell.cellType !== "bento-large" ? " aspect-video" : ""
              }`}
            >
              <Image
                src={asset.publicUrl}
                alt={asset.alt ?? ""}
                fill
                sizes={getCellSizes(cell.cellType)}
                className="object-cover"
                loading="lazy"
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}