import Image from "next/image";
import SectionHeader from "@/components/sections/SectionHeader";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { GallerySection } from "@/types/sections";
import { prisma } from "@/lib/prisma";
import { getLayoutCells, getCellSizes } from "@/lib/gallery-layout";
import { resolveTransitions } from "@/lib/transition-db";
import TransitionTile from "./TransitionTile";
import GalleryClient from "./GalleryClient";
import type { LightboxProject } from "./GalleryLightbox";

type AssetRow = {
  id: string;
  publicUrl: string | null;
  alt: string | null;
  folder: string | null;
  meta: unknown;
  width: number | null;
  height: number | null;
};
type TagRow = { slug: string; name: string; service: string | null };

const ASSET_SELECT = {
  id: true,
  publicUrl: true,
  alt: true,
  folder: true,
  meta: true,
  width: true,
  height: true,
} as const;

async function fetchAssets(section: GallerySection): Promise<AssetRow[]> {
  if (section.mode === "static") {
    // Hand-picked: hidden assets still render here, exactly as the operator chose them.
    const rows = await prisma.asset.findMany({
      where: { id: { in: section.assetIds } },
      select: ASSET_SELECT,
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

  // Hidden assets are excluded from every dynamic membership — a hidden "before" shot is a member of a
  // transition group, not a tile of its own.
  where.hidden = false;

  // Dynamic membership comes from a folder or a tag, so videos land in the result — and every tile
  // is rendered with next/image, which cannot show one (it showed as a broken image). Filter to
  // images here; a row with no mime counts as an image, mirroring `pickCover()`. Static galleries
  // keep exactly what was picked by hand.
  where.OR = [{ mime: { startsWith: "image/" } }, { mime: null }];

  return prisma.asset.findMany({
    where,
    select: ASSET_SELECT,
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
      select: { slug: true, name: true, service: true },
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
      select: { slug: true, name: true, service: true },
      orderBy: { name: "asc" },
    });
    return tags;
  }

  return [];
}

/** Per-asset project info for the lightbox's right panel: one folder row per folder, keyed per asset, so a
 *  tag-driven gallery spanning several folders shows the right panel for whichever image is open. */
async function resolveProjects(assets: AssetRow[]): Promise<Record<string, LightboxProject>> {
  const slugs = [...new Set(assets.map((a) => a.folder).filter(Boolean))] as string[];
  if (!slugs.length) return {};

  const folders = await prisma.folder.findMany({
    where: { slug: { in: slugs } },
    select: { name: true, slug: true, description: true, tags: true },
  });
  const tagSlugs = [...new Set(folders.flatMap((f) => f.tags))];
  const tagRows = tagSlugs.length
    ? await prisma.tag.findMany({ where: { slug: { in: tagSlugs } }, select: { slug: true, name: true, service: true } })
    : [];

  const bySlug = new Map(folders.map((f) => [f.slug, f]));
  const byTag = new Map(tagRows.map((t) => [t.slug, t]));
  const out: Record<string, LightboxProject> = {};
  for (const a of assets) {
    const f = a.folder ? bySlug.get(a.folder) : undefined;
    if (!f) continue;
    out[a.id] = {
      name: f.name,
      slug: f.slug,
      description: f.description,
      tags: f.tags
        .map((s) => byTag.get(s))
        .filter((t): t is TagRow => Boolean(t))
        .map((t) => ({ slug: t.slug, name: t.name, service: t.service })),
    };
  }
  return out;
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

function TagPills({ tags, collectionSlug }: { tags: TagRow[]; collectionSlug: string | null }) {
  if (!tags.length) return null;
  return (
    <div className="w-full px-4 md:px-8 mb-6 flex flex-wrap gap-2">
      {tags.map((tag) =>
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
  );
}

export default async function Gallery(section: GallerySection) {
  const assets = await fetchAssets(section);
  const valid = assets.filter(
    (a): a is AssetRow & { publicUrl: string } => a.publicUrl !== null
  );

  const layout = section.layout ?? "grid";

  // Resolve display tags, the collection-index page slug and every transition group's members in parallel.
  const [tags, collectionSlug, transitions] = await Promise.all([
    resolveTags(section, assets),
    section.tagDisplay?.enabled ? findCollectionIndexPageSlug() : Promise.resolve(null),
    resolveTransitions(valid),
  ]);

  const projects = await resolveProjects(valid);

  if (section.lightbox) {
    return (
      <section id={section.anchor || undefined} className="scroll-mt-[80px]">
        <SectionHeader heading={section.heading} body={section.body} />
        <TagPills tags={tags} collectionSlug={collectionSlug} />
        <GalleryClient
          assets={valid}
          transitions={transitions}
          projects={projects}
          layoutMode={layout === "bento" ? "bento" : "grid"}
          seeMore={section.seeMoreEnabled ? { text: section.seeMoreText, cutoff: section.seeMoreCutoff } : null}
        />
      </section>
    );
  }

  if (layout === "masonry") {
    // Masonry keeps its rounded corners throughout: which column an item lands in is decided by the
    // browser's column balancing, so an item cannot know whether it sits on the screen edge. A group
    // there uses its first member's aspect (the row carries those dimensions).
    return (
      <section id={section.anchor || undefined} className="scroll-mt-[80px]">
        <SectionHeader heading={section.heading} body={section.body} />
        <TagPills tags={tags} collectionSlug={collectionSlug} />
        <div className="w-full columns-1 sm:columns-2 md:columns-3 gap-1.5 px-6">
          {valid.map((asset) => {
            const group = transitions[asset.id];
            return (
              <div key={asset.id} className="break-inside-avoid mb-1.5 rounded-2xl overflow-hidden">
                {group ? (
                  <div
                    className="relative w-full"
                    style={{ aspectRatio: `${asset.width ?? 16} / ${asset.height ?? 9}` }}
                  >
                    <TransitionTile
                      members={group.members}
                      transition={group.transition}
                      sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"
                      quality={85}
                    />
                  </div>
                ) : (
                  <Image
                    src={asset.publicUrl}
                    alt={asset.alt ?? ""}
                    width={800}
                    height={600}
                    sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"
                    quality={85}
                    className="w-full h-auto object-cover"
                    loading="lazy"
                  />
                )}
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  // "bento" and "grid" both use the smart layout engine
  const cells = getLayoutCells(valid.length, layout === "bento" ? "bento" : "grid");

  return (
    <section id={section.anchor || undefined} className="scroll-mt-[80px]">
      <SectionHeader heading={section.heading} body={section.body} />
      <TagPills tags={tags} collectionSlug={collectionSlug} />

      {/* Mobile: simple 1–2 col responsive grid. Inset 24px each side to match the collection index's card
          grid, so every tile carries the same corner radius — no tile touches the screen edge any more. */}
      <div className="md:hidden grid grid-cols-1 sm:grid-cols-2 gap-1.5 px-6">
        {valid.map((asset) => {
          const group = transitions[asset.id];
          return (
            <div key={asset.id} className="relative aspect-video w-full overflow-hidden rounded-2xl">
              {group ? (
                <TransitionTile
                  members={group.members}
                  transition={group.transition}
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
                  className="object-cover"
                  loading="lazy"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop: bento/grid layout engine. The engine places cells on a SIX-column grid (1–6, `span 2`
          per tile, `span 6` for a hero); rendering it in three columns leaves columns 4–6 as implicit auto
          tracks, which collapse to a 0px column and a stray wide one — one tile per triple row comes out
          ~140px wide. GalleryClient (the lightbox path) already declares six. Quality tiers: hero and
          bento-large run full or two-thirds width (q95), the small tiles a third (q85). Inset 24px each
          side like the mobile grid, so corners are uniform. */}
      <div className="hidden md:grid md:grid-cols-6 gap-1.5 px-6">
        {cells.map((cell) => {
          const asset = valid[cell.assetIndex];
          const group = transitions[asset.id];
          return (
            <div
              key={asset.id}
              style={{
                gridColumn: `${cell.colStart} / span ${cell.colSpan}`,
                gridRow: `${cell.rowStart} / span ${cell.rowSpan}`,
              }}
              className={`relative rounded-2xl overflow-hidden${
                cell.cellType !== "bento-large" ? " aspect-video" : ""
              }`}
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
                  className="object-cover"
                  loading="lazy"
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
