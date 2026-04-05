"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { pages } from "@/lib/mockPages";

export default function Navigation() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
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

  useEffect(() => {
    if (open) {
      const first = menuRef.current?.querySelector("a") as HTMLElement | null;
      first?.focus();
    }
  }, [open]);

  return (
    <nav className="relative flex items-center justify-between px-6 py-4">
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
        {navPages.map((page) => (
          <Link key={page.slug} href={`/${page.slug}`} className="font-medium uppercase">
            {page.label}
          </Link>
        ))}
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
            className="absolute right-6 top-full mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5"
          >
            <div className="py-2">
              {navPages.map((page) => (
                <Link
                  key={page.slug}
                  href={`/${page.slug}`}
                  onClick={() => setOpen(false)}
                  className="block px-4 py-2 text-sm font-medium hover:bg-gray-50"
                >
                  {page.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      
    </nav>
  );
}
