"use client";
import { useEffect, useRef } from "react";

export default function VideoClient({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);

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
      src={src}
      muted
      playsInline
      loop
      className="w-full rounded"
    />
  );
}
