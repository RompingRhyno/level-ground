import { prisma } from "@/lib/prisma";
import CollectionItemClient from "./CollectionItemClient";
import type { CollectionItemSection } from "@/types/sections";

type Asset = { id: string; publicUrl: string; alt: string | null };
type RawAsset = { id: string; publicUrl: string | null; alt: string | null; mime: string | null };

type EntityContext = { entitySlug: string; source: "folders" | "tags" };

type Props = CollectionItemSection & { entityContext?: EntityContext };

export default async function CollectionItem({ layout, lightbox, source: sectionSource, entityContext }: Props) {
  if (!entityContext?.entitySlug) {
    return (
      <div
        className="py-12 text-center text-sm"
        style={{ color: "var(--color-text-muted)" }}
      >
        Collection item content loads dynamically when viewed in context.
      </div>
    );
  }

  const { entitySlug } = entityContext;
  const source = entityContext.source ?? sectionSource ?? "folders";

  let name = entitySlug;
  let description: string | null = null;
  let folderTags: string[] = [];
  let assets: (RawAsset & { publicUrl: string })[] = [];
  let tagNameBySlug: Record<string, string> = {};

  if (source === "folders") {
    const folder = await prisma.folder.findUnique({ where: { slug: entitySlug } });
    if (!folder) return null;

    name = folder.name;
    description = (folder as any).description ?? null;
    folderTags = Array.isArray((folder as any).tags) ? [...(folder as any).tags].sort() : [];

    if (folderTags.length) {
      const tagRows = await prisma.tag.findMany({ where: { slug: { in: folderTags } }, select: { slug: true, name: true } });
      tagNameBySlug = Object.fromEntries(tagRows.map((t) => [t.slug, t.name]));
    }

    const rawAssets = await prisma.asset.findMany({
      where: { folder: entitySlug, publicUrl: { not: null } },
      orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
      select: { id: true, publicUrl: true, alt: true, mime: true },
    }) as RawAsset[];
    assets = rawAssets.filter(
      (a: RawAsset): a is RawAsset & { publicUrl: string } =>
        !!a.publicUrl && (!a.mime || a.mime.startsWith("image/"))
    );
  } else {
    // source="tags": find folders tagged with entitySlug, then get their assets
    const taggedFolders = await prisma.folder.findMany({
      where: { tags: { has: entitySlug } },
      select: { slug: true, name: true, description: true },
    });
    if (taggedFolders.length) {
      // show the tag's display name instead of the slug
      const tagRec = await prisma.tag.findUnique({ where: { slug: entitySlug } });
      name = tagRec ? tagRec.name : entitySlug;
      description = null;
      const folderSlugs = taggedFolders.map((f) => f.slug);
      const rawAssets = await prisma.asset.findMany({
        where: { folder: { in: folderSlugs }, publicUrl: { not: null } },
        orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
        select: { id: true, publicUrl: true, alt: true, mime: true },
      }) as RawAsset[];
      assets = rawAssets.filter(
        (a: RawAsset): a is RawAsset & { publicUrl: string } =>
          !!a.publicUrl && (!a.mime || a.mime.startsWith("image/"))
      );
    }
  }

  const displayTags = folderTags
    .filter((t) => t !== "before" && t !== "after")
    .map((s) => tagNameBySlug[s] ?? s);

  return (
    <CollectionItemClient
      name={name}
      description={description}
      displayTags={displayTags}
      assets={assets}
      layout={layout ?? "grid"}
      lightbox={lightbox ?? true}
    />
  );
}
