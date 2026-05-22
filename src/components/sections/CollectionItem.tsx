import { prisma } from "@/lib/prisma";
import CollectionItemClient from "./CollectionItemClient";
import type { CollectionItemSection } from "@/types/sections";

type Asset = { id: string; publicUrl: string; alt: string | null };
type RawAsset = { id: string; publicUrl: string | null; alt: string | null; tags: string[]; mime: string | null };

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

  if (source === "folders") {
    const folder = await prisma.folder.findUnique({ where: { slug: entitySlug } });
    if (!folder) return null;

    name = folder.name;
    description = (folder as any).description ?? null;

    const rawAssets = await prisma.asset.findMany({
      where: { folder: entitySlug, publicUrl: { not: null } },
      orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
      select: { id: true, publicUrl: true, alt: true, tags: true, mime: true },
    }) as RawAsset[];
    assets = rawAssets.filter(
      (a: RawAsset): a is RawAsset & { publicUrl: string } =>
        !!a.publicUrl && (!a.mime || a.mime.startsWith("image/"))
    );

    folderTags = [...new Set(assets.flatMap((a) => a.tags))].sort();
  } else {
    const rawAssets = await prisma.asset.findMany({
      where: { tags: { has: entitySlug }, publicUrl: { not: null } },
      orderBy: { createdAt: "asc" },
      select: { id: true, publicUrl: true, alt: true, tags: true, mime: true },
    }) as RawAsset[];
    assets = rawAssets.filter(
      (a: RawAsset): a is RawAsset & { publicUrl: string } =>
        !!a.publicUrl && (!a.mime || a.mime.startsWith("image/"))
    );
  }

  const displayTags = folderTags.filter((t) => t !== "before" && t !== "after");

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
