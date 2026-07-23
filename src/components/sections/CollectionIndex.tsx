import { getFolders, getFirstAssetUrlsByFolderSlugs, getTagsByFolderSlugs } from "@/lib/folders";
import { getTags, getFirstAssetUrlsByTagSlugs } from "@/lib/tags";
import { getPrimaryCollectionRouteBase } from "@/lib/pages";
import CollectionIndexPresentation from "./CollectionIndexPresentation";

import type { CollectionIndexSection } from "@/types/sections";

type Item = { slug: string; name: string };

export default async function CollectionIndex(props: CollectionIndexSection & { resolvedRouteBase?: string }) {
  const { source, routeBase, heading, entityImages, sortMode, entityOrder, resolvedRouteBase, showTagFilter, maxItems } = props;
  let effectiveRouteBase = routeBase || resolvedRouteBase || "";
  // Cross-page fallback: if this is a reference collection-index on a page
  // without a sibling primary, look up the primary across all pages.
  if (!effectiveRouteBase) {
    const crossPageBase = await getPrimaryCollectionRouteBase();
    if (crossPageBase) effectiveRouteBase = crossPageBase;
  }

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

    items = sorted.slice(0, maxItems || sorted.length).map((f) => ({ slug: f.slug, name: f.name }));
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

    items = sorted.slice(0, maxItems || sorted.length).map((t) => ({ slug: t.slug, name: t.name }));
    firstAssets = await getFirstAssetUrlsByTagSlugs(items.map((i) => i.slug));
  }

  return (
    <CollectionIndexPresentation
      heading={heading}
      items={items}
      firstAssets={firstAssets}
      entityImages={entityImages}
      source={source}
      folderTags={folderTags}
      tagNameBySlug={tagNameBySlug}
      allTagsForFilter={allTagsForFilter}
      showTagFilter={showTagFilter}
      effectiveRouteBase={effectiveRouteBase}
    />
  );
}
