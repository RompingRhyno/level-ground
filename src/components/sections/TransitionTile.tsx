"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { TransitionMeta } from "@/lib/transition";

export type TransitionMember = { id: string; publicUrl: string; alt: string | null };

/**
 * The one renderer for a Before/After transition group: the admin file card, the gallery tiles and the
 * lightbox all use it. Members stack as `next/image` layers filling the parent box; the active one is shown
 * by animating its own property, so every switch uses the same CSS transition and no layer is ever unmounted
 * mid-animation (which would flash).
 *
 * Playback: holds on the first member until *every* member has loaded, cycles only while in view, and stops
 * entirely under `prefers-reduced-motion` (one static frame — the after image).
 * Pills: one per member, the active one enlarged; hovering one shows that member and pauses the cycle until
 * the pointer leaves. They are spans, not buttons — gallery tiles are buttons themselves and nested
 * interactive elements are invalid.
 */
export default function TransitionTile({
  members,
  transition,
  sizes,
  quality,
  fit = "cover",
  showPills = true,
}: {
  members: TransitionMember[];
  transition: Pick<TransitionMeta, "animation" | "animateMs" | "holdMs">;
  sizes: string;
  quality: number;
  fit?: "cover" | "contain";
  showPills?: boolean;
}) {
  const { animation, animateMs, holdMs } = transition;
  const [index, setIndex] = useState(0);
  const [loadedCount, setLoadedCount] = useState(0);
  const [inView, setInView] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [dipping, setDipping] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const allLoaded = loadedCount >= members.length;

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (reduced) setIndex(members.length - 1);
  }, [reduced, members.length]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // The cycle itself: one timeout per step, re-armed on every index change.
  useEffect(() => {
    if (reduced || !inView || !allLoaded || paused || members.length < 2) return;
    const timer = setTimeout(() => setIndex((i) => (i + 1) % members.length), holdMs);
    return () => clearTimeout(timer);
  }, [index, holdMs, reduced, inView, allLoaded, paused, members.length]);

  // Fade-to-black dips a black overlay over the first half of the animation.
  useEffect(() => {
    if (animation !== "fadeBlack" || reduced || members.length < 2) return;
    setDipping(true);
    const timer = setTimeout(() => setDipping(false), Math.max(120, Math.round(animateMs / 2)));
    return () => clearTimeout(timer);
  }, [index, animation, animateMs, reduced, members.length]);

  const layerStyle = (i: number): React.CSSProperties => {
    const active = i === index;
    const base: React.CSSProperties = {
      transitionProperty: "opacity, transform, clip-path",
      transitionDuration: `${animateMs}ms`,
      transitionTimingFunction: "ease-in-out",
    };
    if (animation === "slide" && !reduced) {
      return { ...base, opacity: active ? 1 : 0, transform: active ? "translateX(0)" : "translateX(8%)" };
    }
    if (animation === "wipe" && !reduced) {
      return { ...base, opacity: 1, clipPath: active ? "inset(0 0 0 0)" : "inset(0 0 0 100%)" };
    }
    return { ...base, opacity: active ? 1 : 0 };
  };

  return (
    <div ref={rootRef} className="absolute inset-0 overflow-hidden bg-black/5">
      {members.map((member, i) => (
        <div key={member.id} className="absolute inset-0" style={layerStyle(i)}>
          <Image
            src={member.publicUrl}
            alt={member.alt ?? ""}
            fill
            sizes={sizes}
            quality={quality}
            className={fit === "contain" ? "object-contain" : "object-cover"}
            onLoad={() => setLoadedCount((n) => n + 1)}
            // Only the first frame is a candidate for the LCP; the rest load lazily but immediately, because
            // the cycle waits for them.
            priority={i === 0}
            loading={i === 0 ? undefined : "eager"}
          />
        </div>
      ))}

      {animation === "fadeBlack" && !reduced && (
        <div
          className="pointer-events-none absolute inset-0 bg-black"
          style={{ opacity: dipping ? 1 : 0, transition: `opacity ${Math.max(120, Math.round(animateMs / 2))}ms ease-in-out` }}
        />
      )}

      {showPills && members.length > 1 && (
        <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5">
          {members.map((member, i) => (
            <span
              key={member.id}
              aria-hidden="true"
              onMouseEnter={() => {
                setIndex(i);
                setPaused(true);
              }}
              onMouseLeave={() => setPaused(false)}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                i === index ? "w-6 bg-white" : "w-3 bg-white/50 hover:bg-white/80"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
