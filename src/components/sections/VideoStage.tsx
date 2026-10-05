"use client";
import { useEffect, useRef } from "react";
import VideoClient from "./VideoClient";

type Variants = { "720p"?: string; "1080p"?: string };

/**
 * Distance from the viewport top at which the text starts being pushed down. The sticky header covers
 * the top of the screen, so keying the drift to the stage's top reaching viewport y=0 would let the
 * text sit under the header before it moved; it starts at the header's lower edge plus a gap instead.
 * 67px mirrors the hero's `calc(100svh - 67px)` — `py-4` plus the 35px logo in Navigation.tsx.
 */
const STICKY_HEADER = 67;
const START_GAP = 32;
const DRIFT_START = STICKY_HEADER + START_GAP;

/**
 * Smoothing time constant in ms. The text chases its scroll position instead of being pinned to it, so a
 * wheel notch becomes a glide rather than a jump. 140ms is enough to absorb discrete wheel steps and
 * still feel attached to the scroll — raise it for a lazier, floatier feel, lower it for a tighter one.
 */
const FOLLOW_MS = 140;

/**
 * The video stage: a 16:9 video with the section's text layered over it.
 *
 * Size: the stage is `min(100%, 133.333svh)` wide. At 16:9 that makes its height `min(56.25vw, 75svh)`,
 * so the video stays full-span while a full-span one fits inside 75% of the viewport height, and past
 * that point it stops growing and becomes a centred block instead. 133.333svh is 75svh * 16/9 — the
 * width form of the same cap. Corners follow the same boundary: the cap bites exactly when the viewport
 * is wider than 16/9 * 0.75 = 1.3333, so that is the media query, with no JS and no resize listener.
 * Full-span keeps square corners at the screen edge (the full-bleed convention); a capped video is a
 * card and takes rounded-2xl.
 *
 * Text travels down the video as the page scrolls. The target is y = DRIFT_START - stage.top clamped to
 * [0, stageHeight - textHeight - paddingTop]: above DRIFT_START the text holds at the top-left, from
 * there it and the video move at the same rate, so the text reads as pinned to the eye just under the
 * header while the footage passes beneath it, and it comes to rest just inside the bottom edge rather
 * than sliding off. The painted position eases toward that target (exponential, frame-rate independent)
 * and the rAF loop stops as soon as it has settled, so an idle page costs nothing. Transform-only,
 * passive listener, and nothing attaches at all under prefers-reduced-motion.
 *
 * The editor preview cannot show the drift (its iframe is sized to its own content and does not scroll
 * internally) or the corner rule (its aspect ratio is never the real page's) — that is the preview, not
 * the live page.
 *
 * Below md the text stays above the video: a full-span 16:9 video is only 219px tall on a 390px screen
 * and the block cannot fit over it.
 */
export default function VideoStage({
  heading,
  subheading,
  src,
  poster,
  variants,
}: {
  heading?: string;
  subheading?: string;
  src: string;
  poster?: string;
  variants?: Variants;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const hasText = Boolean(heading || subheading);

  useEffect(() => {
    const stage = stageRef.current;
    const text = textRef.current;
    if (!stage || !text || !hasText) return;

    // Respect reduced-motion: leave the text at the top of the video and attach nothing.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let running = false;
    let painted = 0;
    let lastFrame = 0;
    let inset = parseFloat(getComputedStyle(text).paddingTop) || 0;

    function paint(y: number) {
      text!.style.transform = `translate3d(0, ${y}px, 0)`;
    }

    /** Where the text should sit for the current scroll position, or null when far off screen. */
    function target(): number | null {
      const rect = stage!.getBoundingClientRect();
      // Skipping leaves the last transform in place, so a probe that scrolls far past the stage reads a
      // stale value rather than a moving one.
      if (rect.bottom < -200 || rect.top > window.innerHeight + 200) return null;
      const travel = Math.max(0, rect.height - text!.offsetHeight - inset);
      return Math.min(travel, Math.max(0, DRIFT_START - rect.top));
    }

    function tick(now: number) {
      const goal = target();
      if (goal === null) {
        running = false;
        return;
      }

      const dt = Math.min(64, Math.max(1, now - lastFrame));
      lastFrame = now;
      const ease = 1 - Math.exp(-dt / FOLLOW_MS);
      const next = painted + (goal - painted) * ease;

      if (Math.abs(goal - next) < 0.4) {
        painted = goal;
        paint(painted);
        running = false;
        return;
      }

      painted = next;
      paint(painted);
      raf = requestAnimationFrame(tick);
    }

    function schedule() {
      if (running) return;
      running = true;
      lastFrame = performance.now();
      raf = requestAnimationFrame(tick);
    }

    // First paint is immediate, so the text does not glide in from 0 on load.
    const start = target();
    if (start !== null) {
      painted = start;
      paint(painted);
    }

    function onResize() {
      inset = parseFloat(getComputedStyle(text!).paddingTop) || 0;
      schedule();
    }

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [hasText]);

  const text = hasText ? (
    <>
      <h2
        className="heading text-2xl sm:text-3xl md:text-4xl font-light leading-tight"
        dangerouslySetInnerHTML={{ __html: heading ?? "" }}
        style={{ color: "var(--color-text-inverse)" }}
      />
      {subheading && (
        <p className="mt-3 md:mt-4 max-w-2xl text-sm md:text-base" style={{ color: "var(--color-text-inverse)" }}>
          {subheading}
        </p>
      )}
    </>
  ) : null;

  return (
    <div>
      {/* Below md the same text sits above the video instead of over it. */}
      {text && <div className="md:hidden px-4 pb-6">{text}</div>}

      <div
        ref={stageRef}
        className="relative mx-auto w-[min(100%,133.333svh)] overflow-hidden [@media(min-aspect-ratio:1.3334)]:rounded-2xl"
      >
        <VideoClient src={src} poster={poster} variants={variants} />
        {text && (
          <>
            {/* Left-weighted scrim so the text stays readable over moving footage. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 w-[75%] bg-gradient-to-r from-black/70 via-black/30 to-transparent"
            />
            <div
              ref={textRef}
              className="pointer-events-none absolute left-0 top-0 hidden w-full max-w-4xl px-4 pt-6 will-change-transform md:block md:px-8 md:pt-10"
            >
              {text}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
