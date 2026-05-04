"use client";

import { type MouseEvent, type ReactNode, useEffect, useRef, useState } from "react";
import Image from "next/image";

type Asset = { id: string; publicUrl: string; alt: string | null };

function ChevronLeftIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function LightboxButton({ onClick, label, className, children }: {
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  label: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`w-12 h-12 rounded-full flex items-center justify-center text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white backdrop-blur-sm ${className}`}
    >
      {children}
    </button>
  );
}

export default function GalleryLightbox({
  assets,
  openIndex,
  onClose,
  onGotoIndex,
  onPrev,
  onNext,
}: {
  assets: Asset[];
  openIndex: number | null;
  onClose: () => void;
  onGotoIndex: (i: number) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const open = openIndex;

  // Auto landscape: true when a touch device is in landscape orientation
  const [isLandscape, setIsLandscape] = useState(false);
  const thumbsContainerRef = useRef<HTMLDivElement | null>(null);
  const thumbsRef = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const mql = window.matchMedia("(orientation: landscape) and (pointer: coarse)");
    const handler = (e: MediaQueryListEvent) => setIsLandscape(e.matches);
    setIsLandscape(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (open === null) return;
    const container = thumbsContainerRef.current;
    const btn = thumbsRef.current[open];
    if (!container || !btn) return;

    if (isLandscape) {
      const containerRect = container.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();
      const scrollTop = container.scrollTop + btnRect.top - containerRect.top + btnRect.height / 2 - container.clientHeight / 2;
      container.scrollTo({ top: scrollTop, behavior: "smooth" });
    } else {
      const containerRect = container.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();
      const scrollLeft = container.scrollLeft + btnRect.left - containerRect.left + btnRect.width / 2 - container.clientWidth / 2;
      container.scrollTo({ left: scrollLeft, behavior: "smooth" });
    }
  }, [open, isLandscape]);

  // Prevent body scroll while lightbox is open
  useEffect(() => {
    if (open === null) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = original; };
  }, [open]);

  // Prevent rapid double-fire on touch (touchend + synthetic click)
  const lastNavTime = useRef<number>(0);
  const nav = (fn: () => void) => {
    const now = Date.now();
    if (now - lastNavTime.current < 100) return;
    lastNavTime.current = now;
    fn();
  };

  // Close on Escape (desktop)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (open === null) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className={`w-screen ${isLandscape ? "flex flex-row h-screen overflow-hidden" : "flex flex-col items-center"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Main image */}
        <div className={isLandscape ? "relative flex-1 min-w-0 h-full" : "relative w-full mt-3 max-h-[75vh] xl:max-h-[calc(100vh-200px)] aspect-video"}>
          <Image
            src={assets[open].publicUrl}
            alt={assets[open].alt ?? ""}
            fill
            className="object-contain"
            sizes="100vw"
            priority
          />
          {/* Buttons overlaid — landscape only */}
          {isLandscape && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-row items-center gap-3 z-10">
              <LightboxButton onClick={(e) => { e.stopPropagation(); nav(onPrev); }} label="Previous image" className="bg-black/45 hover:bg-black/65"><ChevronLeftIcon /></LightboxButton>
              <LightboxButton onClick={(e) => { e.stopPropagation(); onClose(); }} label="Close lightbox" className="bg-black/55 hover:bg-black/70"><CloseIcon /></LightboxButton>
              <LightboxButton onClick={(e) => { e.stopPropagation(); nav(onNext); }} label="Next image" className="bg-black/45 hover:bg-black/65"><ChevronRightIcon /></LightboxButton>
            </div>
          )}
        </div>

        {/* Portrait: buttons below image, above thumbnails */}
        {!isLandscape && (
          <div className="flex flex-row items-center gap-3 py-3 px-4">
            <LightboxButton onClick={(e) => { e.stopPropagation(); nav(onPrev); }} label="Previous image" className="bg-white/15 hover:bg-white/25"><ChevronLeftIcon /></LightboxButton>
            <LightboxButton onClick={(e) => { e.stopPropagation(); onClose(); }} label="Close lightbox" className="bg-white/15 hover:bg-white/25"><CloseIcon /></LightboxButton>
            <LightboxButton onClick={(e) => { e.stopPropagation(); nav(onNext); }} label="Next image" className="bg-white/15 hover:bg-white/25"><ChevronRightIcon /></LightboxButton>
          </div>
        )}

        {/* Thumbnails */}
        {isLandscape ? (
          <div
            ref={thumbsContainerRef}
            className="shrink-0 w-48 flex flex-col gap-3 h-full overflow-y-auto py-3 px-2"
          >
            {assets.map((a, idx) => (
              <button
                key={a.id}
                ref={(el) => { thumbsRef.current[idx] = el; }}
                onClick={(e) => { e.stopPropagation(); onGotoIndex(idx); }}
                aria-label={a.alt ?? `Thumbnail ${idx + 1}`}
                aria-current={open === idx}
                className="relative shrink-0 w-full rounded overflow-hidden border bg-black/5 aspect-video"
              >
                <div className="absolute inset-0">
                  <Image src={a.publicUrl} alt={a.alt ?? ""} fill className="object-cover" loading="lazy" />
                </div>
                {open === idx && (
                  <span className="absolute inset-0 pointer-events-none rounded" style={{ border: "4px solid var(--thumbnail-select-color)", zIndex: 10 }} />
                )}
              </button>
            ))}
          </div>
        ) : (
          <div
            ref={thumbsContainerRef}
            className="w-full overflow-x-auto pb-3"
          >
            <div className="flex gap-4 px-4 w-fit mx-auto">
              {assets.map((a, idx) => (
                <button
                  key={a.id}
                  ref={(el) => { thumbsRef.current[idx] = el; }}
                  onClick={(e) => { e.stopPropagation(); onGotoIndex(idx); }}
                  aria-label={a.alt ?? `Thumbnail ${idx + 1}`}
                  aria-current={open === idx}
                  className="relative shrink-0 rounded overflow-hidden border bg-black/5 aspect-video w-40 md:w-48"
                >
                  <div className="absolute inset-0">
                    <Image src={a.publicUrl} alt={a.alt ?? ""} fill className="object-cover" loading="lazy" />
                  </div>
                  {open === idx && (
                    <span className="absolute inset-0 pointer-events-none rounded" style={{ border: "4px solid var(--thumbnail-select-color)", zIndex: 10 }} />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
