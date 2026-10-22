"use client";

import { type PointerEvent, type ReactNode, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ResolvedTransition } from "@/lib/transition";
import { useServiceHref } from "./useServiceLinks";
import TransitionTile from "./TransitionTile";

type Asset = { id: string; publicUrl: string; alt: string | null };

/** What the lightbox's right panel shows for one asset: its project's name, route slug, description and
 *  tags. Built server-side (Gallery.tsx) or from the project page's own props (CollectionItemClient). */
export type LightboxProject = {
  name: string;
  slug: string;
  description: string | null;
  tags: { slug: string; name: string; service?: string | null }[];
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
  "shrink-0 px-5 py-1.5 rounded-full text-base font-medium transition-colors border border-(--tag-border-color) bg-(--btn-primary-bg) text-(--btn-primary-text) hover:bg-(--btn-select) hover:border-(--btn-select) hover:text-(--btn-select-text)";

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
  const serviceHref = useServiceHref();
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
  // The photo's natural size, captured from the loaded main image — used to decide whether the
  // full-screen view should present a landscape photo sideways on a phone.
  const [photoDims, setPhotoDims] = useState<null | { w: number; h: number }>(null);
  // Below lg the lightbox is the phone layout; the rotation below is a phone-mode presentation only.
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const el = photoBoxRef.current;
    if (!el || open === null) return;
    const measure = () => {
      const img = el.querySelector("img");
      if (!img || !img.naturalWidth) {
        setPhotoBox(null);
        return;
      }
      setPhotoDims({ w: img.naturalWidth, h: img.naturalHeight });
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

  // The expanded view must cover exactly what is on screen. `fixed inset-0` sizes to the LAYOUT
  // viewport, which on phones in landscape can be taller and wider than the visible area (browser
  // chrome; emulated portrait metrics), leaving the photo clipped instead of letterboxed. Track the
  // visual viewport while expanded and size the overlay to it — the image is object-contain inside, so
  // it always fits with white bars where the aspect doesn't match.
  const [visualBox, setVisualBox] = useState<null | { left: number; top: number; width: number; height: number }>(null);
  useEffect(() => {
    if (!expanded) return;
    const v = typeof window !== "undefined" ? window.visualViewport : null;
    if (!v) return;
    const update = () =>
      setVisualBox({ left: v.offsetLeft, top: v.offsetTop, width: v.width, height: v.height });
    update();
    v.addEventListener("resize", update);
    v.addEventListener("scroll", update);
    return () => {
      v.removeEventListener("resize", update);
      v.removeEventListener("scroll", update);
    };
  }, [expanded]);

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

  // Opening the full-screen view: refresh the photo's natural size first, so the landscape-rotation
  // decision never depends on when the measurement effect last ran.
  const openExpanded = () => {
    const img = photoBoxRef.current?.querySelector<HTMLImageElement>("img");
    if (img?.naturalWidth) setPhotoDims({ w: img.naturalWidth, h: img.naturalHeight });
    setExpanded(true);
  };

  if (open === null || !asset) return null;

  // Shared pieces of the project panel: on phones the title + button sit above the photo and the tags +
  // description below it; from lg up both live in the right-hand column. The button stacks under the
  // name on phones so a long project name can never shove it against the close control.
  const titleRow = project ? (
    <div className="flex flex-col items-start gap-3 lg:flex-row lg:flex-wrap lg:items-center">
      <h2 className="heading text-[2rem] lg:text-4xl font-light leading-tight">{project.name}</h2>
      {showProjectLink && project.slug && (
        <Link href={`/projects/${project.slug}`} className={PILL_CLASS}>
          See full project
        </Link>
      )}
    </div>
  ) : null;

  // Tags + description: the same block in the phone layout (under the photo) and the desktop panel.
  const metaBlock = project ? (
    <>
      {project.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {/* Covers link to their service category's section, the same as the project page's own
              pills; one without a service stays a plain chip. */}
          {project.tags.map((tag) => {
            const href = serviceHref(tag.service);
            const className =
              "text-[13px] lg:text-sm px-3 py-1 rounded-full border border-(--tag-border-color) text-(--color-text-dark) transition-colors hover:bg-(--btn-select) hover:border-(--btn-select) hover:text-(--btn-select-text)";
            return href ? (
              <Link key={tag.slug} href={href} onClick={onClose} className={className}>
                {tag.name}
              </Link>
            ) : (
              <span key={tag.slug} className={className}>
                {tag.name}
              </span>
            );
          })}
        </div>
      )}
      {project.description && (
        <p className="mt-5 leading-relaxed text-[17px] lg:text-lg" style={{ color: "var(--color-text-dark)" }}>
          {project.description}
        </p>
      )}
    </>
  ) : null;

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

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-visible">
        {/* Phones: project name and the See-full-project link lead, before the photo. */}
        {project && (
          <div className="order-1 lg:hidden pl-5 pr-14 pt-4 pb-3 shrink-0">{titleRow}</div>
        )}

        {/* Photo + navigation — two thirds of the width on desktop. On phones the photo runs full width
            between the title and the tags, with the arrows (and the expand control) on a row under it. */}
        <div className="order-2 lg:order-1 shrink-0 lg:h-auto lg:w-2/3 min-h-0 flex flex-col lg:flex-row lg:items-stretch">
          {/* Left arrow column — desktop only; phones get the controls row under the photo. */}
          <div className="w-[clamp(3.25rem,8vw,7rem)] shrink-0 hidden lg:flex items-center justify-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                nav(onPrev);
              }}
              aria-label="Previous image"
              className="group h-20 lg:h-24 w-[clamp(2.5rem,6vw,5rem)] rounded-2xl flex items-center justify-center text-(--color-text-dark) hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-text-dark)"
            >
              <ChevronLeftIcon />
            </button>
          </div>

          {/* 4:3 on phones: the usual photo shape fills the box, so there is no letterbox band above or
              below it. At lg the box is the flexible middle of the row instead. */}
          <div
            ref={photoBoxRef}
            className="relative w-full aspect-[4/3] lg:aspect-auto lg:flex-1 min-w-0 flex items-center justify-center lg:py-2"
            // Fit the box to the photo's own ratio once its size is known, so the photo fills the
            // container exactly instead of leaving letterbox bars above and below at 4:3.
            style={photoDims ? { aspectRatio: `${photoDims.w} / ${photoDims.h}` } : undefined}
          >
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
                  openExpanded();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openExpanded();
                  }
                }}
                className="absolute cursor-zoom-in"
                style={{ left: photoBox.left, top: photoBox.top, width: photoBox.width, height: photoBox.height }}
              />
            )}
          </div>

          {/* Phones: previous / expand / next as one row directly under the photo. */}
          <div className="lg:hidden flex items-center justify-center gap-5 py-2.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                nav(onPrev);
              }}
              aria-label="Previous image"
              className="h-12 w-16 rounded-2xl flex items-center justify-center text-(--color-text-dark) hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-text-dark)"
            >
              <ChevronLeftIcon />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openExpanded();
              }}
              aria-label="Expand image"
              className="h-11 w-11 rounded-full border border-(--color-border) bg-white flex items-center justify-center text-(--color-text-dark) transition-colors hover:bg-(--btn-select) hover:border-(--btn-select) hover:text-(--btn-select-text) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-text-dark)"
            >
              <ExpandIcon />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                nav(onNext);
              }}
              aria-label="Next image"
              className="h-12 w-16 rounded-2xl flex items-center justify-center text-(--color-text-dark) hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-text-dark)"
            >
              <ChevronRightIcon />
            </button>
          </div>

          {/* Desktop right column: the next arrow is vertically centred, and the expand control sits at
              the midpoint between the top of the screen and that arrow — a quarter of the column height
              less half the arrow plus the button's own half: calc(25% - 44px). */}
          <div className="relative w-[clamp(3.25rem,8vw,7rem)] shrink-0 hidden lg:flex flex-col items-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openExpanded();
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
                className="group h-20 lg:h-24 w-[clamp(2.5rem,6vw,5rem)] rounded-2xl flex items-center justify-center text-(--color-text-dark) hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-text-dark)"
              >
                <ChevronRightIcon />
              </button>
            </div>
          </div>
        </div>

        {/* Panel. Phones get the tags and description under the photo (the mobile block below); from lg
            up the whole panel is the right-hand third, as before. Collapses away entirely when the asset
            has no project data (a static gallery with no folder behind it). */}
        {project && (
          <>
            <div className="order-3 lg:hidden pl-5 pr-5 pb-6 shrink-0">{metaBlock}</div>

            <aside className="order-2 hidden lg:block lg:w-1/3 overflow-y-auto px-5 py-5 lg:py-12 lg:pl-0 lg:pr-16 shrink-0">
              {/* min-h-full + justify-center centres the panel's content, and unlike auto margins it never
                  clips the top when the description is longer than the column. */}
              <div className="min-h-full flex flex-col justify-center">
                {titleRow}
                {metaBlock}
              </div>
            </aside>
          </>
        )}
      </div>

      {/* Thumbnail strip — pinned to the bottom of the lightbox, so it stays in view while the content
          above it scrolls. Full width, draggable to scroll; the active one carries the highlight. */}
      <div
        ref={thumbsContainerRef}
        className="shrink-0 sticky bottom-0 z-10 bg-white overflow-x-auto cursor-grab active:cursor-grabbing select-none"
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
              className="relative shrink-0 rounded-[14px] overflow-hidden bg-black/5 aspect-video w-28"
            >
              <div className="absolute inset-0">
                <Image src={a.publicUrl} alt="" fill className="object-cover" loading="lazy" sizes="112px" />
              </div>
              {/* The ring rides on an overlay above the image: an inset box-shadow paints below the
                  element's children, so putting it on the button hides it behind the thumbnail. The
                  overlay shares the button's radius (rounded-2xl) so the ring's INNER edge curves
                  with it — an un-rounded overlay insets the shadow into a square, which leaves the
                  inside corners visibly angular. Same radius as the button, so the outer edge and the
                  parent's clip land on one arc and no slivers appear at the corners. */}
              {open === idx && (
                <div
                  aria-hidden
                  className="absolute inset-0 rounded-[14px] pointer-events-none thumbnail-selected"
                />
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
          style={visualBox ?? undefined}
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
          ) : narrow && photoDims && photoDims.w > photoDims.h ? (
            /* Phone + landscape photo: present it sideways. The box is the visual viewport with its
               axes swapped, rotated 90° counter-clockwise, so the photo uses the screen's long edge the
               way a landscape photo should — turn the phone to read it upright. Portrait photos, and the
               desktop lightbox, are untouched. */
            <div
              className="relative shrink-0 rotate-[-90deg] w-[100dvh] h-[100vw]"
              style={visualBox ? { width: visualBox.height, height: visualBox.width } : undefined}
            >
              <Image
                src={asset.publicUrl}
                alt={asset.alt ?? ""}
                fill
                className="object-contain"
                sizes="100vh"
                quality={95}
                priority
              />
            </div>
          ) : (
            <Image src={asset.publicUrl} alt={asset.alt ?? ""} fill className="object-contain" sizes="100vw" quality={95} priority />
          )}
        </div>
      )}
    </div>
  );
}
