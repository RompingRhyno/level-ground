"use client";

import Image from "next/image";
import Link from "next/link";
import GalleryClient from "./GalleryClient";
import TransitionTile from "./TransitionTile";
import type { LightboxProject } from "./GalleryLightbox";
import type { GalleryLayout } from "@/types/sections";
import type { ResolvedTransition } from "@/lib/transition";
import { useServiceHref } from "./useServiceLinks";

type Asset = { id: string; publicUrl: string; alt: string | null };

type TagRow = { slug: string; name: string; /** Service slug; absent in the editor preview. */ service?: string | null };

type Props = {
  name: string;
  description?: string | null;
  displayTags: TagRow[];
  collectionSlug?: string | null;
  assets: Asset[];
  transitions?: Record<string, ResolvedTransition>;
  layout: GalleryLayout;
  lightbox: boolean;
};

// Full-bleed tiles with a 6px gutter, like Gallery.tsx. Every image needs its own `sizes`: without one
// next/image assumes 100vw and the browser fetches the largest candidate for a third-width tile.
const TILE_SIZES = "(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw";

function StaticGrid({
  assets,
  transitions,
  layout,
}: {
  assets: Asset[];
  transitions: Record<string, ResolvedTransition>;
  layout: GalleryLayout;
}) {
  if (layout === "masonry") {
    // Rounded throughout: which column an item lands in is the browser's column balancing, so an item
    // cannot know whether it sits on the screen edge.
    return (
      <div className="w-full columns-1 sm:columns-2 md:columns-3 gap-1.5">
        {assets.map((a, i) => {
          const group = transitions[a.id];
          return (
            <div key={a.id} className="break-inside-avoid mb-1.5 rounded-2xl overflow-hidden">
              {group ? (
                <div className="relative w-full aspect-video">
                  <TransitionTile
                    members={group.members}
                    transition={group.transition}
                    sizes={TILE_SIZES}
                    quality={90}
                  />
                </div>
              ) : (
                <Image
                  src={a.publicUrl}
                  alt={a.alt ?? ""}
                  width={800}
                  height={600}
                  sizes={TILE_SIZES}
                  quality={90}
                  className="w-full object-cover"
                  loading={i === 0 ? "eager" : "lazy"}
                  fetchPriority={i === 0 ? "high" : undefined}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  }
  // 1 / 2 / 3 columns of a full-bleed row, so the corner that sits on a screen edge is square at each
  // breakpoint: at one column a tile touches both edges, at two the left tile squares its left pair and
  // the right tile its right pair, and at three the same logic applies to first/middle/last.
  return (
    <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
      {assets.map((a, i) => {
        const sm = i % 2 === 0 ? "sm:rounded-r-2xl" : "sm:rounded-l-2xl";
        const md =
          i % 3 === 0
            ? "md:rounded-r-2xl"
            : i % 3 === 1
              ? "md:rounded-2xl"
              : "md:rounded-l-2xl md:rounded-r-none";
        const group = transitions[a.id];
        return (
          <div key={a.id} className={`relative aspect-video overflow-hidden rounded-none ${sm} ${md}`}>
            {group ? (
              <TransitionTile
                members={group.members}
                transition={group.transition}
                sizes={TILE_SIZES}
                quality={90}
              />
            ) : (
              <Image
                src={a.publicUrl}
                alt={a.alt ?? ""}
                fill
                sizes={TILE_SIZES}
                quality={90}
                className="object-cover"
                loading={i === 0 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : undefined}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function CollectionItemClient({
  name,
  description,
  displayTags,
  collectionSlug,
  assets,
  transitions = {},
  layout,
  lightbox,
}: Props) {
  const serviceHref = useServiceHref();

  // The page is this project's own, so its lightbox panel is built from the props already in hand — no
  // per-asset lookup — and "See full project" would link to the page you are on, so it is dropped here.
  const project: LightboxProject | null = collectionSlug
    ? { name, slug: collectionSlug, description: description ?? null, tags: displayTags }
    : null;
  const projects: Record<string, LightboxProject> = project
    ? Object.fromEntries(assets.map((a) => [a.id, project]))
    : {};

  return (
    <div>
      {/* Text carries its own padding — the section wrapper is full-bleed with no edge inset — while the
          media grids below run flush to the edges. */}
      <div className="px-4 md:px-8">
        <h1
          className="heading max-w-4xl text-3xl sm:text-4xl md:text-5xl font-light leading-tight mb-6"
          style={{ color: "var(--color-text-heading)" }}
        >
          {name}
        </h1>

        {displayTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {/* Each cover links to its service category — the section for that service on the
                installation or maintenance page. A cover without a service (or in a preview that has
                no collection route) falls back to the tag filter, then to plain text. */}
            {displayTags.map((tag) => {
              const href =
                serviceHref(tag.service) ??
                (collectionSlug ? `/${collectionSlug}?tag=${encodeURIComponent(tag.slug)}` : null);
              return href ? (
                <Link
                  key={tag.slug}
                  href={href}
                  className="text-sm px-3 py-1 rounded-full border border-(--tag-border-color) bg-(--btn-primary-bg) text-(--btn-primary-text) hover:bg-(--btn-select) hover:text-(--btn-select-text)"
                >
                  {tag.name}
                </Link>
              ) : (
                <span key={tag.slug} className="text-sm px-3 py-1 rounded-full border border-(--tag-border-color) bg-(--btn-primary-bg) text-(--btn-primary-text)">
                  {tag.name}
                </span>
              );
            })}
          </div>
        )}

        {/* `whitespace-pre-line`: the description is a textarea in the media editor, so line breaks
            typed there are part of the value — without it they collapse into one paragraph here. */}
        {description && (
          <p className="mb-10 max-w-3xl whitespace-pre-line" style={{ color: "var(--color-text-primary)" }}>
            {description}
          </p>
        )}
      </div>

      {assets.length > 0 && (
        lightbox ? (
          <GalleryClient
            assets={assets}
            transitions={transitions}
            projects={projects}
            showProjectLink={false}
            layoutMode={layout}
            eagerFirst
          />
        ) : (
          <StaticGrid assets={assets} transitions={transitions} layout={layout} />
        )
      )}
    </div>
  );
}
