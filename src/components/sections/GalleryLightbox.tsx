"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ResolvedTransition } from "@/lib/transition";
import TransitionTile from "./TransitionTile";

type Asset = { id: string; publicUrl: string; alt: string | null };

/** What the lightbox's right panel shows for one asset: its project's name, route slug, description and
 *  tags. Built server-side (Gallery.tsx) or from the project page's own props (CollectionItemClient). */
export type LightboxProject = {
  name: string;
  slug: string;
  description: string | null;
  tags: { slug: string; name: string }[];
};

function ChevronLeftIcon() {
  return (
    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

export default function GalleryLightbox({
  assets,
  transitions,
  projects = {},
  showProjectLink = true,
  openIndex,
  onClose,
  onGotoIndex,
  onPrev,
  onNext,
}: {
  assets: Asset[];
  transitions: Record<string, ResolvedTransition>;
  projects?: Record<string, LightboxProject>;
  showProjectLink?: boolean;
  openIndex: number | null;
  onClose: () => void;
  onGotoIndex: (i: number) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const open = openIndex;
  const [expanded, setExpanded] = useState(false);
  const thumbsContainerRef = useRef<HTMLDivElement | null>(null);
  const thumbsRef = useRef<Array<HTMLButtonElement | null>>([]);

  const asset = open !== null ? assets[open] : null;
  const project = asset ? projects[asset.id] : undefined;
  const group = asset ? transitions[asset.id] : undefined;

  // A new image means a fresh, non-expanded view.
  useEffect(() => {
    setExpanded(false);
  }, [open]);

  // Prevent body scroll while lightbox is open
  useEffect(() => {
    if (open === null) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  // Prevent rapid double-fire on touch (touchend + synthetic click)
  const lastNavTime = useRef<number>(0);
  const nav = (fn: () => void) => {
    const now = Date.now();
    if (now - lastNavTime.current < 100) return;
    lastNavTime.current = now;
    fn();
  };

  // Escape minimises an expanded image first (browser convention), then closes the lightbox.
  // Left/Right navigate.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (expanded) setExpanded(false);
        else onClose();
      } else if (e.key === "ArrowLeft") {
        nav(onPrev);
      } else if (e.key === "ArrowRight") {
        nav(onNext);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Keep the active thumbnail in view.
  useEffect(() => {
    if (open === null) return;
    const container = thumbsContainerRef.current;
    const btn = thumbsRef.current[open];
    if (!container || !btn) return;
    const containerRect = container.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const scrollLeft =
      container.scrollLeft + btnRect.left - containerRect.left + btnRect.width / 2 - container.clientWidth / 2;
    container.scrollTo({ left: scrollLeft, behavior: "smooth" });
  }, [open]);

  if (open === null || !asset) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-white flex flex-col"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      {/* Close — top right of the overlay, above everything. */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close lightbox"
        className="absolute top-3 right-3 z-20 h-11 w-11 rounded-full flex items-center justify-center text-(--color-text-dark) hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-text-dark)"
      >
        <CloseIcon />
      </button>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* Photo + navigation — two thirds of the width on desktop, below the panel on mobile. */}
        <div className="relative order-2 lg:order-1 lg:w-2/3 min-h-0 flex items-center justify-center">
          {/* Each arrow's hit area is the whole vertical strip beside the photo, so there is no missing
              it; the visible affordance is a small circle around the glyph. */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              nav(onPrev);
            }}
            aria-label="Previous image"
            className="group absolute left-0 top-0 h-full w-20 lg:w-28 z-10 flex items-center justify-start pl-3 lg:justify-center lg:pl-0"
          >
            <span className="rounded-full p-2 text-(--color-text-dark) transition-colors group-hover:bg-black/5">
              <ChevronLeftIcon />
            </span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              nav(onNext);
            }}
            aria-label="Next image"
            className="group absolute right-0 top-0 h-full w-20 lg:w-28 z-10 flex items-center justify-end pr-3 lg:justify-center lg:pr-0"
          >
            <span className="rounded-full p-2 text-(--color-text-dark) transition-colors group-hover:bg-black/5">
              <ChevronRightIcon />
            </span>
          </button>

          <div
            role="button"
            tabIndex={0}
            aria-label="Expand image"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setExpanded(true);
              }
            }}
            className={`relative w-full h-full min-h-0 flex items-center justify-center px-20 lg:px-28 py-2 ${
              expanded ? "" : "cursor-zoom-in"
            }`}
          >
            {group ? (
              <TransitionTile
                members={group.members}
                transition={group.transition}
                sizes="(min-width: 1024px) 66vw, 100vw"
                quality={95}
                fit="contain"
              />
            ) : (
              <Image
                src={asset.publicUrl}
                alt={asset.alt ?? ""}
                fill
                className="object-contain"
                sizes="(min-width: 1024px) 66vw, 100vw"
                quality={95}
                priority
              />
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(true);
              }}
              aria-label="Expand image"
              className="absolute top-3 right-3 h-10 w-10 rounded-full border border-(--color-border) bg-white/90 flex items-center justify-center text-(--color-text-dark) hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-text-dark)"
            >
              <ExpandIcon />
            </button>
          </div>
        </div>

        {/* Info panel — the right third on desktop, above the photo on mobile. Collapses away entirely
            when the asset has no project data (a static gallery with no folder behind it). */}
        {project && (
          <aside
            className="order-1 lg:order-2 lg:w-1/3 overflow-y-auto px-5 py-5 lg:py-12 lg:px-8 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-baseline gap-3">
              <h2 className="heading text-2xl font-light leading-tight">{project.name}</h2>
              {showProjectLink && project.slug && (
                <Link
                  href={`/projects/${project.slug}`}
                  className="shrink-0 rounded-full border border-(--tag-border-color) px-3 py-1 text-sm text-(--color-text-dark) hover:bg-black/5"
                >
                  See full project
                </Link>
              )}
            </div>
            {project.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {project.tags.map((tag) => (
                  <span
                    key={tag.slug}
                    className="text-sm px-3 py-1 rounded-full border border-(--tag-border-color) text-(--color-text-dark)"
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            )}
            {project.description && (
              <p className="mt-5 leading-relaxed" style={{ color: "var(--color-text-dark)" }}>
                {project.description}
              </p>
            )}
          </aside>
        )}
      </div>

      {/* Thumbnail strip — always at the bottom, full width. The active one carries the highlight. */}
      <div
        ref={thumbsContainerRef}
        className="shrink-0 border-t border-(--color-border) bg-white overflow-x-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-2 px-4 py-3 w-fit mx-auto">
          {assets.map((a, idx) => (
            <button
              key={a.id}
              type="button"
              ref={(el) => {
                thumbsRef.current[idx] = el;
              }}
              onClick={() => onGotoIndex(idx)}
              aria-label={a.alt ?? `Thumbnail ${idx + 1}`}
              aria-current={open === idx}
              className="relative shrink-0 rounded overflow-hidden border border-(--color-border) bg-black/5 aspect-video w-28"
            >
              <div className="absolute inset-0">
                <Image src={a.publicUrl} alt="" fill className="object-cover" loading="lazy" sizes="112px" />
              </div>
              <div className={`absolute inset-0 pointer-events-none rounded ${open === idx ? "thumbnail-selected" : ""}`} />
            </button>
          ))}
        </div>
      </div>

      {/* Expanded: the image fills the viewport on white. Click anywhere (zoom-out cursor) or Escape
          minimises back to the two-column view. */}
      {expanded && (
        <div
          className="fixed inset-0 z-[60] bg-white flex items-center justify-center cursor-zoom-out"
          role="dialog"
          aria-modal="true"
          aria-label="Expanded image"
          onClick={() => setExpanded(false)}
        >
          {group ? (
            <TransitionTile members={group.members} transition={group.transition} sizes="100vw" quality={95} fit="contain" />
          ) : (
            <Image src={asset.publicUrl} alt={asset.alt ?? ""} fill className="object-contain" sizes="100vw" quality={95} priority />
          )}
        </div>
      )}
    </div>
  );
}
