"use client";
import { useEffect, useRef, useState } from "react";

type Variants = { "720p"?: string; "1080p"?: string };

export default function VideoClient({
  src,
  poster,
  variants,
}: {
  src: string;
  poster?: string;
  variants?: Variants;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [currentSrc, setCurrentSrc] = useState(src);

  // Pick the rendition on the client: the player is full-bleed, so a phone should not pull the 1080p file
  // and a 2560-wide window should not upscale the 720p one. The stored original stays the fallback when the
  // asset has no captured variants.
  useEffect(() => {
    if (!variants) return;
    const needed = window.innerWidth * window.devicePixelRatio;
    const pick = needed > 1600 ? variants["1080p"] : variants["720p"];
    if (pick && pick !== src) setCurrentSrc(pick);
  }, [variants, src]);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: 0.9 }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  if (!src) {
    // Mirrors the page preview's empty state. An empty `src` on <video> makes the browser request the
    // page itself, which is what produced the console error this replaced.
    return (
      <div className="w-full aspect-video rounded bg-(--color-bg-secondary) flex items-center justify-center text-sm text-(--color-text-primary)">
        No video selected
      </div>
    );
  }

  return (
    <video
      ref={ref}
      src={currentSrc}
      poster={poster}
      preload="metadata"
      muted
      playsInline
      loop
      className="w-full aspect-video object-cover"
    />
  );
}
