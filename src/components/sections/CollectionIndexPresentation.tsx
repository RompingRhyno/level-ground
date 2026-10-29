"use client";

import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

type Item = { slug: string; name: string };
type CoverTag = { slug: string; name: string; service: string | null };

/** What the index is currently filtered by. Services are the categories; tags are the covers. */
export type CollectionFilter = { kind: "service" | "tag"; slug: string } | null;

export type CollectionIndexPresentationProps = {
  heading?: string;
  items: Item[];
  firstAssets: Record<string, string>;
  entityImages?: Record<string, string>;
  source: "folders" | "tags";
  folderTags: Record<string, string[]>;
  /** Every service, in canonical display order — the first level of the filter. */
  services: { slug: string; name: string }[];
  /** Cover tags in use, each carrying the service it belongs to — the second level. */
  coverTags: CoverTag[];
  showTagFilter?: boolean;
  effectiveRouteBase: string;
  /** Preview only: the active filter is held in state rather than the URL. */
  activeFilter?: CollectionFilter;
  onFilterClick?: (next: CollectionFilter) => void;
  mode?: "primary" | "reference";
  /** The reference-mode link's text. Defaults to "See More". */
  seeMoreText?: string;
};

const chipClass = (lit: boolean): string =>
  `text-xs px-1.5 py-0.5 rounded-full border border-(--tag-border-color) transition-colors ${
    lit ? "bg-(--color-bg-primary) text-(--color-text-dark)" : "text-white bg-black/60"
  }`;

function pillClass(isActive: boolean): string {
  const base = "px-4 py-1 rounded-full text-base transition-colors border border-(--tag-border-color)";
  return `${base} ${
    isActive
      ? "btn-selected"
      : "bg-(--btn-primary-bg) text-(--btn-primary-text) hover:bg-(--btn-select) hover:text-(--btn-select-text)"
  }`;
}

/**
 * Pure presentational — renders the card grid only. No heading, no filters.
 *
 * Covers (Patio, Hedges, Concrete slab…) appear only while a service filter is active, and then only
 * the covers belonging to that service — the unfiltered index shows no chips at all. Covers are plain
 * text, not links — the filter lives in the row above.
 */
function ItemGrid({
  items,
  firstAssets,
  entityImages,
  source,
  folderTags,
  coverTags,
  effectiveRouteBase,
  activeFilter,
}: CollectionIndexPresentationProps) {
  if (items.length === 0) {
    return <p className="text-(--color-text-muted)">No items found.</p>;
  }

  const serviceByTag = new Map(coverTags.map((t) => [t.slug, t.service]));
  const coverNameBySlug = new Map(coverTags.map((t) => [t.slug, t.name]));
  const activeService = activeFilter?.kind === "service" ? activeFilter.slug : null;

  // 1 / 2 / 4 columns, never 3: the index runs on fours (the home index caps at four), and a
  // three-column tier split that set 3 + 1 at 1024-1279px. Only column counts that divide the
  // common set are used; a long list still just ends on a partial row.
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 px-6">
      {items.map((item) => {
        const image = entityImages?.[item.slug] ?? firstAssets[item.slug];
        // Folder tags can also carry non-cover markers (before/after); only known covers render.
        const covers = (source === "folders" ? (folderTags[item.slug] ?? []) : []).filter((t) =>
          coverNameBySlug.has(t)
        );
        // Chips appear only while a service is selected, and then only for that service's covers —
        // an unfiltered index stays clean, and a filtered card reads as "this is what matched".
        const visibleCovers = activeService
          ? covers.filter((slug) => serviceByTag.get(slug) === activeService)
          : [];
        return (
          <Link
            key={item.slug}
            href={`${effectiveRouteBase}/${item.slug}`}
            className="group block rounded-2xl overflow-hidden"
          >
            <div className="relative aspect-video w-full">
              {image ? (
                <Image src={image} alt={item.name} fill sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, (max-width: 1279px) 33vw, 25vw" quality={90} className="object-cover transition-transform duration-[1000ms] group-hover:will-change-transform group-hover:[transform:scale(1.03)]" />
              ) : (
                <div className="absolute inset-0 bg-(--color-bg-secondary)" />
              )}
              {visibleCovers.length > 0 && (
                <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
                  {visibleCovers.map((slug) => (
                    <span key={slug} className={chipClass(true)}>
                      {coverNameBySlug.get(slug)}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4">
              <h3 className="text-lg font-medium">{item.name}</h3>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

/**
 * Two-level filter. The first row is always every service. Picking one reveals that service's
 * covers as a second row, so the grid can be narrowed from a category down to a single cover —
 * and picking a cover keeps its service row visible, inferred from the cover itself.
 */
function ServiceFilterPills({
  services,
  coverTags,
  activeFilter,
  isPreview,
  onFilterClick,
}: {
  services: { slug: string; name: string }[];
  coverTags: CoverTag[];
  activeFilter: CollectionFilter;
  isPreview: boolean;
  onFilterClick?: (next: CollectionFilter) => void;
}) {
  const serviceByTag = new Map(coverTags.map((t) => [t.slug, t.service]));
  const activeService =
    activeFilter?.kind === "service"
      ? activeFilter.slug
      : activeFilter?.kind === "tag"
        ? (serviceByTag.get(activeFilter.slug) ?? null)
        : null;
  // Only the services a project actually has a cover for.
  const usedServices = services.filter((s) => coverTags.some((c) => c.service === s.slug));

  const renderPill = (slug: string, name: string, isActive: boolean, next: CollectionFilter) =>
    isPreview ? (
      <button
        key={slug}
        type="button"
        onClick={() => onFilterClick?.(next)}
        className={pillClass(isActive)}
      >
        {name}
      </button>
    ) : (
      <Link
        key={slug}
        href={next ? `${next.kind === "service" ? "?service" : "?tag"}=${encodeURIComponent(next.slug)}` : "?"}
        className={pillClass(isActive)}
      >
        {name}
      </Link>
    );

  return (
    <div className="flex flex-wrap gap-2">
      {usedServices.map((s) =>
        renderPill(
          s.slug,
          s.name,
          activeService === s.slug,
          activeService === s.slug ? null : { kind: "service", slug: s.slug }
        )
      )}
    </div>
  );
}

/** Inner component — uses a client hook for filtering, renders the filter pills + ItemGrid. */
function CollectionIndexPresentationInner(props: CollectionIndexPresentationProps) {
  const {
    services,
    coverTags,
    showTagFilter,
    folderTags,
    activeFilter: activeFilterProp,
    onFilterClick,
    effectiveRouteBase,
    mode,
  } = props;

  const isPreview = !!onFilterClick;
  const searchParams = useSearchParams();

  // One filter at a time: an explicit prop (preview) wins, then ?service=, then ?tag=.
  const activeFilter: CollectionFilter =
    activeFilterProp ??
    (searchParams.get("service")
      ? { kind: "service", slug: searchParams.get("service") as string }
      : searchParams.get("tag")
        ? { kind: "tag", slug: searchParams.get("tag") as string }
        : null);

  const serviceByTag = new Map(coverTags.map((t) => [t.slug, t.service]));
  const filteredItems = !activeFilter
    ? props.items
    : activeFilter.kind === "service"
      ? props.items.filter((item) =>
          (folderTags[item.slug] ?? []).some((t) => serviceByTag.get(t) === activeFilter.slug)
        )
      : props.items.filter((item) => (folderTags[item.slug] ?? []).includes(activeFilter.slug));

  return (
    <div>
      {/* Filter pills row — the reference-mode "See More" sits with the heading instead. */}
      {showTagFilter && services.length > 0 && (
        <div className="px-4 md:px-8 flex flex-wrap items-start justify-between gap-2 mb-6">
          <ServiceFilterPills
            services={services}
            coverTags={coverTags}
            activeFilter={activeFilter}
            isPreview={isPreview}
            onFilterClick={onFilterClick}
          />
        </div>
      )}
      <ItemGrid {...props} activeFilter={activeFilter} items={filteredItems} />
    </div>
  );
}

/**
 * Default export — heading rendered outside Suspense (static, no
 * useSearchParams needed). Filter pills and grid inside Suspense.
 *
 * In reference mode the "See More" button belongs to the heading row (right-aligned, in line with
 * the heading) rather than the filter row below it.
 */
export default function CollectionIndexPresentation(props: CollectionIndexPresentationProps) {
  const seeMore =
    props.mode === "reference" && props.effectiveRouteBase ? (
      <Link
        href={props.effectiveRouteBase}
        className="ml-auto shrink-0 px-5 py-2 rounded-full text-base font-medium transition-colors border border-(--tag-border-color) bg-(--btn-primary-bg) text-(--btn-primary-text) hover:bg-(--btn-select) hover:text-(--btn-select-text)"
      >
        {props.seeMoreText?.trim() || "See More"}
      </Link>
    ) : null;

  return (
    <div>
      {(props.heading || seeMore) && (
        <div className="px-4 md:px-8 flex flex-wrap items-center justify-between gap-2 mb-6">
          {props.heading && (
            <h2
              className="heading max-w-4xl text-3xl sm:text-3xl md:text-5xl font-light leading-tight"
              dangerouslySetInnerHTML={{ __html: props.heading }}
              style={{ color: "var(--color-text-heading)" }}
            />
          )}
          {seeMore}
        </div>
      )}
      <Suspense fallback={<ItemGrid {...props} />}>
        <CollectionIndexPresentationInner {...props} />
      </Suspense>
    </div>
  );
}
