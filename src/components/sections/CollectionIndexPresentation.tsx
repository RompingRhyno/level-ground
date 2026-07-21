"use client";

import Link from "next/link";
import Image from "next/image";

type Item = { slug: string; name: string };

export type CollectionIndexPresentationProps = {
  heading?: string;
  items: Item[];
  firstAssets: Record<string, string>;
  entityImages?: Record<string, string>;
  source: "folders" | "tags";
  folderTags: Record<string, string[]>;
  tagNameBySlug: Record<string, string>;
  allTagsForFilter: { slug: string; name: string }[];
  showTagFilter?: boolean;
  effectiveRouteBase: string;
  activeTag?: string | null;
  onTagClick?: (slug: string | null) => void;
};

export default function CollectionIndexPresentation({
  heading,
  items,
  firstAssets,
  entityImages,
  source,
  folderTags,
  tagNameBySlug,
  allTagsForFilter,
  showTagFilter,
  effectiveRouteBase,
  activeTag,
  onTagClick,
}: CollectionIndexPresentationProps) {
  const isPreview = !!onTagClick;
  return (
    <div>
      {heading && (
        <h2
          className="heading text-3xl sm:text-3xl md:text-5xl font-light leading-tight mb-6"
          dangerouslySetInnerHTML={{ __html: heading }}
          style={{ color: "var(--color-text-heading)" }}
        />
      )}
      {showTagFilter && allTagsForFilter.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8">
          {allTagsForFilter.map((t) => {
            const isActive = (activeTag ?? null) === t.slug;
            if (isPreview) {
              return (
                <button
                  key={t.slug}
                  type="button"
                  onClick={() => onTagClick?.(isActive ? null : t.slug)}
                  className={`px-4 py-1 rounded-full text-base transition-colors border border-[var(--tag-border-color)] ${isActive ? "btn-selected" : "bg-(--btn-primary-bg) text-(--btn-primary-text) hover:bg-(--btn-select) hover:text-(--btn-select-text)"}`}
                >
                  {t.name}
                </button>
              );
            }
            return (
              <Link
                key={t.slug}
                href={isActive ? "?" : `?tag=${encodeURIComponent(t.slug)}`}
                className={`px-4 py-1 rounded-full text-base transition-colors border border-[var(--tag-border-color)] ${isActive ? "btn-selected" : "bg-(--btn-primary-bg) text-(--btn-primary-text) hover:bg-(--btn-select) hover:text-(--btn-select-text)"}`}
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
                href={`${effectiveRouteBase}/${item.slug}`}
                className="group block border border-(--color-border) rounded-lg overflow-hidden hover:shadow-md transition-shadow"
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
                        <span key={tagSlug} className="text-xs text-white bg-black/60 px-1.5 py-0.5 rounded-full border border-(--tag-border-color)">
                          {tagNameBySlug[tagSlug] ?? tagSlug}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="p-4 bg-white transition-colors duration-200 group-hover:bg-(--color-brand-dark)">
                  <h3 className="text-lg font-medium transition-colors duration-200 group-hover:text-white">{item.name}</h3>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}