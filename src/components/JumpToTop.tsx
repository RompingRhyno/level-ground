"use client";

import { useEffect, useState } from "react";

/**
 * Floating "jump to top" button, bottom-right. Opt-in per page from the page editor; it appears
 * once the visitor has scrolled past roughly the first viewport, so the top of a page stays clean.
 */
export default function JumpToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // 300px, not a full viewport: a page only a little longer than the screen never scrolls 600px,
    // so a taller threshold would silently never show the button (measured on /about: max scroll 470).
    const onScroll = () => setVisible(window.scrollY > 300);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      aria-label="Jump to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105"
      style={{ backgroundColor: "var(--color-brand-primary)", color: "#ffffff" }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
