"use client";

import { type PointerEvent, type ReactNode, useEffect, useRef, useState } from "react";
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
    <svg className="w-[clamp(1.25rem,2.2vw,1.75rem)] h-[clamp(1.25rem,2.2vw,1.75rem)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="w-[clamp(1.25rem,2.2vw,1.75rem)] h-[clamp(1.25rem,2.2vw,1.75rem)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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

// The pill is the collection index's "See More" button: outlined until hover, then the brand
// background with white text.
// The hover border joins the fill: a border that stays a different colour from the fill leaves an
// antialiased seam that reads as a fuzzy halo on a tight radius.
const PILL_CLASS =
  "shrink-0 px-5 py-2 rounded-full text-base font-medium transition-colors border border-(--tag-border-color) bg-(--btn-primary-bg) text-(--btn-primary-text) hover:bg-(--btn-select) hover:border-(--btn-select) hover:text-(--btn-select-text)";

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

  // The zoom hit area is the photo's real box, not the letterboxed container: an object-contain image
  // fills its element while the photo inside it is smaller. Measure the fitted box (the same arithmetic
  // object-fit: contain does) and put the click target and the zoom-in cursor on an overlay of that size.
  const photoBoxRef = useRef<HTMLDivElement | null>(null);
  const [photoBox, setPhotoBox] = useState<null | { left: number; top: number; width: number; height: number }>(null);

  useEffect(() => {
    const el = photoBoxRef.current;
    if (!el || open === null) return;
    const measure = () => {
      const img = el.querySelector("img");
      if (!img || !img.naturalWidth) {
        setPhotoBox(null);
        return;
      }
      const r = el.getBoundingClientRect();
      const scale = Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight);
      const width = img.naturalWidth * scale;
      const height = img.naturalHeight * scale;
      setPhotoBox({ left: (r.width - width) / 2, top: (r.height - height) / 2, width, height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    const imgs = Array.from(el.querySelectorAll("img"));
    imgs.forEach((img) => img.addEventListener("load", measure));
    return () => {
      observer.disconnect();
      imgs.forEach((img) => img.removeEventListener("load", measure));
    };
  }, [open, asset?.id]);

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

  // Drag to scroll the thumbnail strip (pointer events cover a real mouse drag; touch keeps its
  // native scroll, which is why the handlers only act on mouse pointers). A drag never selects a
  // thumbnail.
  const dragRef = useRef({ active: false, startX: 0, startScroll: 0, moved: false });

  const onStripPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || !thumbsContainerRef.current) return;
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startScroll: thumbsContainerRef.current.scrollLeft,
      moved: false,
    };
  };

  const onStripPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d.active || !thumbsContainerRef.current) return;
    const dx = e.clientX - d.startX;
    if (Math.abs(dx) > 3) d.moved = true;
    thumbsContainerRef.current.scrollLeft = d.startScroll - dx;
  };

  const endStripDrag = () => {
    dragRef.current.active = false;
  };

  const onThumbClick = (idx: number) => {
    if (dragRef.current.moved) return;
    onGotoIndex(idx);
  };

  if (open === null || !asset) return null;

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col" role="dialog" aria-modal="true">
      {/* Deliberately no click-to-close on the surface: only the x button and Escape dismiss the
          lightbox. The expanded overlay is the exception — its own click zooms back out. */}
      {/* Close — top right of the overlay, above everything. */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close lightbox"
        className="absolute top-3 right-3 z-20 h-11 w-11 rounded-full border border-(--color-border) bg-white flex items-center justify-center text-(--color-text-dark) transition-colors hover:bg-(--btn-select) hover:border-(--btn-select) hover:text-(--btn-select-text) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-text-dark)"
      >
        <CloseIcon />
      </button>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* Photo + navigation — two thirds of the width on desktop, below the panel on mobile. The
            arrows sit in their own columns beside the photo, never on top of it. */}
        {/* Below lg this block is a column item with no intrinsic height (the image is absolutely
            positioned), so it takes the remaining space with flex-1; at lg it is exactly the 2/3 column. */}
        <div className="order-2 lg:order-1 flex-1 lg:flex-none lg:w-2/3 min-h-0 flex items-stretch">
          {/* The arrow is a rectangle sized to its glyph — the whole rectangle is the hover target, so
              its extent is visible — vertically centred beside the photo. */}
          <div className="w-[clamp(3.25rem,8vw,7rem)] shrink-0 flex items-center justify-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                nav(onPrev);
              }}
              aria-label="Previous image"
              className="group h-20 lg:h-24 w-[clamp(2.5rem,6vw,5rem)] rounded-lg flex items-center justify-center text-(--color-text-dark) hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-text-dark)"
            >
              <ChevronLeftIcon />
            </button>
          </div>

          <div ref={photoBoxRef} className="relative flex-1 min-w-0 flex items-center justify-center py-2">
            {group ? (
              <TransitionTile
                members={group.members}
                transition={group.transition}
                sizes="(min-width: 1024px) 52vw, 100vw"
                quality={95}
                fit="contain"
              />
            ) : (
              <Image
                src={asset.publicUrl}
                alt={asset.alt ?? ""}
                fill
                className="object-contain"
                sizes="(min-width: 1024px) 52vw, 100vw"
                quality={95}
                priority
              />
            )}
            {/* The zoom target sits exactly on the photo, so clicking the letterbox around it does
                nothing. The expanded overlay deliberately keeps its whole-surface click to zoom out. */}
            {photoBox && (
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
                className="absolute cursor-zoom-in"
                style={{ left: photoBox.left, top: photoBox.top, width: photoBox.width, height: photoBox.height }}
              />
            )}
          </div>

          {/* Right column: the next arrow is vertically centred, and the expand control sits at the
              midpoint between the top of the screen and that arrow — which is a quarter of the column
              height less half the arrow plus the button's own half: calc(25% - 44px). */}
          <div className="relative w-[clamp(3.25rem,8vw,7rem)] shrink-0 flex flex-col items-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(true);
              }}
              aria-label="Expand image"
              className="absolute left-1/2 -translate-x-1/2 top-[calc(25%-40px)] lg:top-[calc(25%-44px)] h-10 w-10 rounded-full border border-(--color-border) bg-white flex items-center justify-center text-(--color-text-dark) transition-colors hover:bg-(--btn-select) hover:border-(--btn-select) hover:text-(--btn-select-text) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-text-dark)"
            >
              <ExpandIcon />
            </button>
            <div className="flex-1 w-full flex items-center justify-center">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  nav(onNext);
                }}
                aria-label="Next image"
                className="group h-20 lg:h-24 w-[clamp(2.5rem,6vw,5rem)] rounded-lg flex items-center justify-center text-(--color-text-dark) hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-text-dark)"
              >
                <ChevronRightIcon />
              </button>
            </div>
          </div>
        </div>

        {/* Info panel — the right third on desktop, above the photo on mobile. Collapses away entirely
            when the asset has no project data (a static gallery with no folder behind it). */}
        {project && (
          <aside
            className="order-1 lg:order-2 lg:w-1/3 overflow-y-auto px-5 py-5 lg:py-12 lg:pl-0 lg:pr-16 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {/* min-h-full + justify-center centres the panel's content, and unlike auto margins it never
                clips the top when the description is longer than the column. */}
            <div className="min-h-full flex flex-col justify-center">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="heading text-4xl font-light leading-tight">{project.name}</h2>
              {showProjectLink && project.slug && (
                <Link href={`/projects/${project.slug}`} className={PILL_CLASS}>
                  See full project
                </Link>
              )}
            </div>
            {project.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {project.tags.map((tag) => (
                  <span
                    key={tag.slug}
                    className="text-sm px-3 py-1 rounded-full border border-(--tag-border-color) text-(--color-text-dark) transition-colors hover:bg-(--btn-select) hover:border-(--btn-select) hover:text-(--btn-select-text)"
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
            </div>
          </aside>
        )}
      </div>

      {/* Thumbnail strip — always at the bottom, full width, draggable to scroll. The active one
          carries the highlight. */}
      <div
        ref={thumbsContainerRef}
        className="shrink-0 overflow-x-auto cursor-grab active:cursor-grabbing select-none"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={onStripPointerDown}
        onPointerMove={onStripPointerMove}
        onPointerUp={endStripDrag}
        onPointerLeave={endStripDrag}
      >
        <div className="flex gap-2 px-4 py-3 w-fit mx-auto">
          {assets.map((a, idx) => (
            <button
              key={a.id}
              type="button"
              ref={(el) => {
                thumbsRef.current[idx] = el;
              }}
              onClick={() => onThumbClick(idx)}
              aria-label={a.alt ?? `Thumbnail ${idx + 1}`}
              aria-current={open === idx}
              className="relative shrink-0 rounded overflow-hidden bg-black/5 aspect-video w-28"
            >
              <div className="absolute inset-0">
                <Image src={a.publicUrl} alt="" fill className="object-cover" loading="lazy" sizes="112px" />
              </div>
              {/* The ring rides on an overlay above the image: an inset box-shadow paints below the
                  element's children, so putting it on the button hides it behind the thumbnail. No
                  rounded here on purpose — the button's overflow-hidden and border-radius clip this
                  overlay to the exact rounded padding box, so the ring fills right up to the border's
                  inner edge including the corners. A rounded on the overlay would give it a second,
                  slightly different arc and leave slivers at each corner. */}
              {open === idx && (
                <div aria-hidden className="absolute inset-0 pointer-events-none thumbnail-selected" />
              )}
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
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(false);
          }}
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
