"use client";
import VideoClient from "./VideoClient";

type Variants = { "720p"?: string; "1080p"?: string };

/**
 * Where the text parks while the video scrolls beneath it. The sticky header covers the top of the
 * screen, so the text holds clear of it rather than tucking under it. 67px mirrors the hero's
 * `calc(100svh - 67px)` — `py-4` plus the 35px logo in Navigation.tsx.
 */
const STICKY_HEADER = 67;
const START_GAP = 32;
const DRIFT_START = STICKY_HEADER + START_GAP;

/** How much clear space the text leaves inside the bottom edge when it comes to rest. */
const BOTTOM_INSET = 40;

/**
 * The video stage: a 16:9 video with the section's text layered over it.
 *
 * Size: the stage is `min(100%, 133.333svh)` wide. At 16:9 that makes its height `min(56.25vw, 75svh)`,
 * so the video stays full-span while a full-span one fits inside 75% of the viewport height, and past
 * that point it stops growing and becomes a centred block instead. `133.333svh` is `75svh * 16/9` — the
 * width form of the same cap. Corners follow the same boundary: the cap bites exactly when the viewport
 * is wider than `16/9 * 0.75 = 1.3333`, so that is the media query, with no JS and no resize listener.
 *
 * Text travel is CSS `sticky`, not a scroll listener. The text parks `DRIFT_START` below the viewport
 * top while the video scrolls under it, so relative to the video it moves *down*, and it comes to rest
 * `BOTTOM_INSET` inside the bottom edge when the container's bottom catches up — then rides out with
 * the section. This is the same geometry as a JS scroll handler, but the browser composites it, so it is
 * rigid: no per-frame reads, no easing constant, and nothing to jitter when the wheel jumps (a handler
 * has to chase the scroll position and reads as jittery however it is smoothed).
 *
 * Three structural rules make the sticky work, and each is a trap worth naming:
 *  - the text layer is a **sibling** of the clipped media, never a descendant. An `overflow: hidden`
 *    ancestor creates a scroll container, and sticky then measures against that instead of the viewport
 *    and never sticks at all. The video and its scrim are clipped by an inner wrapper purely so the
 *    rounded corners work; the text sits outside it.
 *  - the layer's `bottom` inset bounds the travel: sticky stops when its containing block's bottom
 *    arrives, so insetting the layer is what leaves `BOTTOM_INSET` clear at the end.
 *  - it is `motion-safe:` only, so a reduced-motion visitor gets the text parked at the top of the video.
 *
 * Below md the text stays above the video: a full-span 16:9 video is only 219px tall on a 390px screen
 * and the block cannot fit over it.
 *
 * The editor preview cannot show the travel (its iframe is sized to its own content and does not scroll
 * internally) or the corner rule (its aspect ratio is never the real page's).
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
  const hasText = Boolean(heading || subheading);

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

      <div className="relative mx-auto w-[min(100%,133.333svh)]">
        {/* Media and scrim are clipped together so the rounded corners clip both. */}
        <div className="relative overflow-hidden [@media(min-aspect-ratio:1.3334)]:rounded-2xl">
          <VideoClient src={src} poster={poster} variants={variants} />
          {text && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 w-[75%] bg-gradient-to-r from-black/70 via-black/30 to-transparent"
            />
          )}
        </div>

        {/* Sibling of the clipped wrapper, not a child: see the note above. */}
        {text && (
          <div
            className="pointer-events-none absolute inset-x-0 top-0 hidden md:block"
            style={{ bottom: BOTTOM_INSET }}
          >
            <div
              className="w-full max-w-4xl px-4 pt-6 md:px-8 md:pt-10 motion-safe:sticky"
              style={{ top: DRIFT_START }}
            >
              {text}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
