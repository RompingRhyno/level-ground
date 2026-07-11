import Link from "next/link";
import Image from "next/image";
import { getFolders, getFirstAssetUrlsByFolderSlugs, getTagsByFolderSlugs } from "@/lib/folders";
import { getTags, getFirstAssetUrlsByTagSlugs } from "@/lib/tags";

import type { CollectionIndexSection } from "@/types/sections";

type Item = { slug: string; name: string };

export default async function CollectionIndex(props: CollectionIndexSection & { filterTag?: string }) {
  const { source, routeBase, heading, entityImages, sortMode, entityOrder, filterTag } = props;

  let items: Item[] = [];
  let firstAssets: Record<string, string> = {};
  let folderTags: Record<string, string[]> = {};
  let tagNameBySlug: Record<string, string> = {};
  let allTagsForFilter: { slug: string; name: string }[] = [];

  if (source === "folders") {
    const folders = await getFolders();

    let sorted = [...folders];
    if (sortMode === "custom" && entityOrder?.length) {
      const orderMap = new Map(entityOrder.map((s, i) => [s, i]));
      sorted.sort(
        (a, b) =>
          (orderMap.get(a.slug) ?? folders.length) - (orderMap.get(b.slug) ?? folders.length)
      );
    } else if (sortMode === "latest") {
      sorted.sort(
        (a, b) =>
          new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime()
      );
    } else if (sortMode === "earliest") {
      sorted.sort(
        (a, b) =>
          new Date(a.createdAt as any).getTime() - new Date(b.createdAt as any).getTime()
      );
    }
    // alphabetical (default): getFolders() returns name ASC

    // Filter by tag if one is selected
    const filteredFolders = filterTag
      ? sorted.filter((f) => f.tags.includes(filterTag))
      : sorted;

    items = filteredFolders.map((f) => ({ slug: f.slug, name: f.name }));
    const slugs = items.map((i) => i.slug);
    const allSlugs = sorted.map((f) => f.slug);
    [firstAssets, folderTags] = await Promise.all([
      getFirstAssetUrlsByFolderSlugs(slugs),
      getTagsByFolderSlugs(allSlugs),
    ]);
    const allTags = await getTags();
    tagNameBySlug = Object.fromEntries(allTags.map((t) => [t.slug, t.name]));

    // Build tag list: only tags that appear on at least one folder
    const usedTagSlugs = new Set(sorted.flatMap((f) => f.tags));
    allTagsForFilter = allTags.filter((t) => usedTagSlugs.has(t.slug));
  } else if (source === "tags") {
    const tags = await getTags();

    let sorted = [...tags];
    if (sortMode === "custom" && entityOrder?.length) {
      const orderMap = new Map(entityOrder.map((s, i) => [s, i]));
      sorted.sort(
        (a, b) =>
          (orderMap.get(a.slug) ?? tags.length) - (orderMap.get(b.slug) ?? tags.length)
      );
    } else if (sortMode === "latest") {
      sorted.sort(
        (a, b) =>
          new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime()
      );
    } else if (sortMode === "earliest") {
      sorted.sort(
        (a, b) =>
          new Date(a.createdAt as any).getTime() - new Date(b.createdAt as any).getTime()
      );
    }

    items = sorted.map((t) => ({ slug: t.slug, name: t.name }));
    firstAssets = await getFirstAssetUrlsByTagSlugs(items.map((i) => i.slug));
  }

  return (
    <div>
      {heading && (
        <h2
          className="heading text-3xl sm:text-3xl md:text-5xl font-light leading-tight mb-6"
          dangerouslySetInnerHTML={{ __html: heading }}
          style={{ color: "var(--color-text-heading)" }}
        />
      )}
      {allTagsForFilter.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8">
          {allTagsForFilter.map((t) => {
            const isActive = filterTag === t.slug;
            return (
              <Link
                key={t.slug}
                href={isActive ? "?" : `?tag=${encodeURIComponent(t.slug)}`}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${isActive ? "btn-selected" : "admin-btn"}`}
              >
                {t.name}
              </Link>
            );
          })}
        </div>
      )}
      {items.length === 0 ? (
        <p className="text-(--color-text-muted)">No items found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => {
            const image = entityImages?.[item.slug] ?? firstAssets[item.slug];
            const tags = source === "folders" ? (folderTags[item.slug] ?? []) : [];
            return (
              <Link
                key={item.slug}
                href={`${routeBase}/${item.slug}`}
                className="block border border-(--color-border) rounded-lg overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="relative aspect-video w-full">
                  {image ? (
                    <Image src={image} alt={item.name} fill sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" className="object-cover" />
                  ) : (
                    <div className="absolute inset-0 bg-(--color-bg-secondary)" />
                  )}
                  {tags.length > 0 && (
                    <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
                      {tags.map((tagSlug) => (
                        <span key={tagSlug} className="text-xs text-white bg-black/60 px-1.5 py-0.5 rounded-full">
                          {tagNameBySlug[tagSlug] ?? tagSlug}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="p-4 bg-white">
                  <h3 className="text-lg font-medium">{item.name}</h3>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
