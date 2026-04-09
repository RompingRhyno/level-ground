"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { pages } from "@/lib/mockPages";

export default function Navigation() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const navPages = pages.filter((p) => p.slug !== "home");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    function onPointer(e: PointerEvent) {
      if (!open) return;
      const target = e.target as Node | null;
      if (!target) return;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const pathname = usePathname();

  useEffect(() => {
    if (open) {
      // focus the menu container for accessibility without highlighting the first item
      if (menuRef.current) {
        menuRef.current.focus();
      }
    }
  }, [open]);
  
  // scroll-driven open/close behavior (accumulated)
  useEffect(() => {
    let lastY = typeof window !== "undefined" ? window.scrollY : 0;
    let accDown = 0;
    let accUp = 0;
    const closeThreshold = 80; // px accumulated downward to force-close
    const openOnTopThreshold = 20; // px from top to consider "at top"
    const openAccumThreshold = 8; // accumulated upward px to open when near top

    function onScroll() {
      const y = window.scrollY;
      const delta = y - lastY;

      if (delta > 0) {
        accDown += delta;
        accUp = 0;
      } else if (delta < 0) {
        accUp += -delta;
        accDown = 0;
      }

      // Close when enough downward scroll accumulated
      if (accDown > closeThreshold && open) {
        setOpen(false);
        accDown = 0;
      }

      // If near the top and user has scrolled up a bit, open
      if (y <= openOnTopThreshold && accUp > openAccumThreshold && !open) {
        setOpen(true);
        accUp = 0;
      }

      lastY = y;
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [open]);

  return (
    <nav
      ref={navRef}
      className="sticky top-0 left-0 right-0 w-full z-50 flex items-center justify-between px-6 py-4"
        style={{
          backgroundColor: "var(--color-bg-primary)",
          WebkitBackdropFilter: "blur(4px)",
          backdropFilter: "blur(4px)",
        }}
    >
      {/* Logo on the left */}
      <div className="shrink-0">
        <Link href="/">
          <Image
            src="/logo-dark.webp"
            alt="Level Ground Landscaping"
            width={252}
            height={36}
          />
        </Link>
      </div>

      {/* Desktop links */}
      <div className="hidden md:flex gap-8 items-center">
        {navPages.map((page) => {
          const href = `/${page.slug}`;
          const isActive = pathname === href;
          return (
            <Link
              key={page.slug}
              href={href}
              className={`font-medium uppercase ${isActive ? "underline" : ""}`}
            >
              {page.label}
            </Link>
          );
        })}
      </div>

      {/* Mobile hamburger */}
      <div className="md:hidden">
        <button
          id="mobile-menu-button"
          ref={buttonRef}
          aria-label="Toggle menu"
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((s) => !s)}
          className="inline-flex items-center justify-center rounded-md p-2 hover:bg-gray-100"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>

        {open && (
          <div
            id="mobile-menu"
            ref={menuRef}
            role="menu"
            aria-labelledby="mobile-menu-button"
            className="fixed left-0 right-0 z-40 w-full bg-transparent"
            style={{ top: navRef.current ? `${navRef.current.offsetHeight}px` : undefined }}
          >
            <div
              className="max-w-7xl mx-auto px-6"
              style={{ backgroundColor: "var(--color-bg-primary)", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.08)" }}
            >
              <div className="py-2">
                {navPages.map((page) => {
                  const href = `/${page.slug}`;
                  const isActive = pathname === href;
                  return (
                    <Link
                      key={page.slug}
                      href={href}
                      onClick={() => setOpen(false)}
                      className={
                        `block px-4 py-3 text-base font-medium hover:bg-gray-50 hover:rounded-md focus:bg-gray-50 focus:rounded-md text-left ${
                          isActive ? "bg-gray-100 rounded-md" : ""
                        }`
                      }
                    >
                      {page.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      
    </nav>
  );
}
