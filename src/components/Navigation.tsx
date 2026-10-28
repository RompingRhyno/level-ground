"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
type NavPage = { slug: string; label: string; navPill?: boolean };

export default function Navigation({ navPages }: { navPages: NavPage[] }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const navRef = useRef<HTMLElement | null>(null);

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
  
  // Scroll-driven close: once the user has scrolled a meaningful distance down, collapse the menu.
  // (The mirror behaviour — returning to the top of the page popping the menu open — was removed: on
  // mobile it opened the hamburger unprompted whenever the page settled near the top.)
  useEffect(() => {
    let lastY = typeof window !== "undefined" ? window.scrollY : 0;
    let accDown = 0;
    const closeThreshold = 80; // px accumulated downward to force-close

    function onScroll() {
      const y = window.scrollY;
      const delta = y - lastY;

      if (delta > 0) {
        accDown += delta;
      } else if (delta < 0) {
        accDown = 0;
      }

      if (accDown > closeThreshold && open) {
        setOpen(false);
        accDown = 0;
      }

      lastY = y;
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [open]);

  return (
    <nav
      ref={navRef}
      className="sticky top-0 left-0 right-0 w-full z-50 flex items-stretch justify-between px-6"
        style={{
          backgroundColor: "var(--color-bg-primary)",
          WebkitBackdropFilter: "blur(4px)",
          backdropFilter: "blur(4px)",
        }}
    >
      {/* Logo on the left (with mobile breadcrumb underneath). Shrink-safe: on very narrow phones the
          fixed 252px artwork would otherwise push the row past the viewport. */}
      <div className="shrink min-w-0 flex items-center py-4">
        <Link href="/" className="flex min-w-0">
          <Image
            src="/logo-dark.png"
            alt="Level Ground Landscaping"
            // Intrinsic size (504x71), not the display size: declaring 252x36 rounds the ratio to
            // 7.00 and at h-9 the rendered width lands on 256, so Next flags one dimension as modified.
            width={504}
            height={71}
            className="h-9 w-auto max-w-full object-contain"
          />
        </Link>
      </div>

      {/* Desktop links. They only fit from lg up — the row is ~960px wide, so phones in landscape
          (and tablets in portrait) get the hamburger instead of a horizontally scrolling page. */}
      <div className="hidden lg:flex gap-0 items-stretch">
        {navPages.map((page) => {
          const href = `/${page.slug}`;
          const isActive = pathname === href;
          if (page.navPill) {
            return (
              <Link key={page.slug} href={href} className="btn-primary self-center mx-2">
                {page.label}
              </Link>
            );
          }
          return (
            <Link
              key={page.slug}
              href={href}
              className={`font-medium uppercase px-4 flex items-center border-b-[8px] transition-colors duration-150 ${isActive ? "border-(--color-brand-logo)" : "border-transparent hover:border-(--color-brand-logo)"}`}
            >
              {page.label}
            </Link>
          );
        })}
      </div>

      {/* Mobile hamburger */}
      <div className="lg:hidden flex items-center py-4">
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
