"use client";

import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

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
  mode?: "primary" | "reference";
};

/** Pure presentational — renders the card grid only. No heading, no filters. */
function ItemGrid({
  items,
  firstAssets,
  entityImages,
  source,
  folderTags,
  tagNameBySlug,
  effectiveRouteBase,
}: CollectionIndexPresentationProps) {
  if (items.length === 0) {
    return <p className="text-(--color-text-muted)">No items found.</p>;
  }

  return (
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
  );
}

function TagFilterPills({
  allTagsForFilter,
  activeTag,
  isPreview,
  onTagClick,
}: {
  allTagsForFilter: { slug: string; name: string }[];
  activeTag: string | null;
  isPreview: boolean;
  onTagClick?: (slug: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {allTagsForFilter.map((t) => {
        const isActive = (activeTag ?? null) === t.slug;
        if (isPreview) {
          return (
            <button
              key={t.slug}
              type="button"
              onClick={() => onTagClick?.(isActive ? null : t.slug)}
              className={`px-4 py-1 rounded-full text-base transition-colors border border-(--tag-border-color) ${isActive ? "btn-selected" : "bg-(--btn-primary-bg) text-(--btn-primary-text) hover:bg-(--btn-select) hover:text-(--btn-select-text)"}`}
            >
              {t.name}
            </button>
          );
        }
        return (
          <Link
            key={t.slug}
            href={isActive ? "?" : `?tag=${encodeURIComponent(t.slug)}`}
            className={`px-4 py-1 rounded-full text-base transition-colors border border-(--tag-border-color) ${isActive ? "btn-selected" : "bg-(--btn-primary-bg) text-(--btn-primary-text) hover:bg-(--btn-select) hover:text-(--btn-select-text)"}`}
          >
            {t.name}
          </Link>
        );
      })}
    </div>
  );
}

/** Inner component — uses client hook for tag filtering, renders tag filter + ItemGrid. */
function CollectionIndexPresentationInner(props: CollectionIndexPresentationProps) {
  const {
    allTagsForFilter,
    showTagFilter,
    folderTags,
    activeTag: activeTagProp,
    onTagClick,
    effectiveRouteBase,
    mode,
  } = props;

  const isPreview = !!onTagClick;
  const searchParams = useSearchParams();
  const activeTag = activeTagProp ?? searchParams.get("tag");

  // Client-side tag filtering
  const filteredItems = activeTag
    ? props.items.filter((item) => (folderTags[item.slug] ?? []).includes(activeTag))
    : props.items;

  return (
    <div>
      {/* Tag filter + See More row */}
      {(showTagFilter || mode === "reference") && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
          {showTagFilter && allTagsForFilter.length > 0 && (
            <TagFilterPills
              allTagsForFilter={allTagsForFilter}
              activeTag={activeTag ?? null}
              isPreview={isPreview}
              onTagClick={onTagClick}
            />
          )}
          {/* Spacer if only one side has content */}
          {mode === "reference" && effectiveRouteBase && (
            <Link
              href={effectiveRouteBase}
              className="ml-auto shrink-0 px-5 py-2 rounded-full text-base font-medium transition-colors border border-(--tag-border-color) bg-(--btn-primary-bg) text-(--btn-primary-text) hover:bg-(--btn-select) hover:text-(--btn-select-text)"
            >
              See More
            </Link>
          )}
        </div>
      )}
      <ItemGrid {...props} items={filteredItems} />
    </div>
  );
}

/**
 * Default export — heading rendered outside Suspense (static, no
 * useSearchParams needed). Tag pills and grid inside Suspense.
 */
export default function CollectionIndexPresentation(props: CollectionIndexPresentationProps) {
  return (
    <div>
      {props.heading && (
        <h2
          className="heading text-3xl sm:text-3xl md:text-5xl font-light leading-tight mb-6"
          dangerouslySetInnerHTML={{ __html: props.heading }}
          style={{ color: "var(--color-text-heading)" }}
        />
      )}
      <Suspense fallback={<ItemGrid {...props} />}>
        <CollectionIndexPresentationInner {...props} />
      </Suspense>
    </div>
  );
}