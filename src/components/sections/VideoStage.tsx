"use client";
import { useEffect, useRef } from "react";
import VideoClient from "./VideoClient";

type Variants = { "720p"?: string; "1080p"?: string };

/**
 * The video stage: a full-span 16:9 video with the section's text layered over it.
 *
 * Text travels down the video as the page scrolls. The mapping is deliberately "the text holds still
 * on screen while the video slides under it": y = -(stage.top), so once the stage's top reaches the
 * viewport top the two move at the same rate and the text reads as pinned to the eye while the footage
 * passes. It is clamped at 0 above that (the text sits at the top-left while the video scrolls into
 * view) and at `stageHeight - textHeight - inset` below, so it comes to rest just inside the bottom
 * edge rather than sliding off the video. Transform-only, rAF-throttled, passive listener.
 *
 * Corners: the video is exactly 16:9 and full-span, so its height is vw*9/16 and "taller than 80% of
 * the viewport" is equivalent to the *viewport* being wider than 16/9*0.8 = 1.4223 — a pure media
 * query, no JS, no resize listener. Below that it stays square-cornered at the screen edge, matching
 * the full-bleed convention; past it, it reads as a card and takes rounded-2xl. Note the editor
 * preview cannot show this faithfully: its iframe is sized to its content, so its own aspect ratio is
 * never the real page's.
 *
 * Below md the text block would not fit a full-span 16:9 video (219px tall on a 390px screen), so the
 * text stays above the video there and only overlays from md up.
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

    let frame = 0;

    function place() {
      frame = 0;
      if (!stage || !text) return;
      const rect = stage.getBoundingClientRect();
      // Skip the maths while the stage is nowhere near the viewport.
      if (rect.bottom < -200 || rect.top > window.innerHeight + 200) return;

      const inset = parseFloat(getComputedStyle(text).paddingTop) || 0;
      const travel = Math.max(0, rect.height - text.offsetHeight - inset);
      const y = Math.min(travel, Math.max(0, -rect.top));
      text.style.transform = `translate3d(0, ${y}px, 0)`;
    }

    function onScroll() {
      if (!frame) frame = requestAnimationFrame(place);
    }

    place();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
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
        className="relative w-full overflow-hidden [@media(min-aspect-ratio:1.4223)]:rounded-2xl"
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
