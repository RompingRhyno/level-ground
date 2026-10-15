"use client";

import lottie, { type AnimationItem } from "lottie-web";
import { useEffect, useRef } from "react";

/**
 * The 404 illustration, ported from the original WordPress site (Elementor Lottie widget,
 * `lf20_jCmeIg.json`). Pure vector, loops; under `prefers-reduced-motion` it renders the first
 * frame statically instead of animating. Decorative — the message carries the meaning.
 */
export default function NotFoundAnimation() {
  const container = useRef<HTMLDivElement>(null);
  const animation = useRef<AnimationItem | null>(null);

  useEffect(() => {
    if (!container.current) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    animation.current = lottie.loadAnimation({
      container: container.current,
      renderer: "svg",
      loop: true,
      autoplay: !reduce,
      path: "/lottie/404-gardener.json",
    });
    if (reduce) animation.current.goToAndStop(0, true);
    return () => {
      animation.current?.destroy();
      animation.current = null;
    };
  }, []);

  return <div ref={container} aria-hidden="true" className="w-full max-w-[520px] mx-auto" />;
}
