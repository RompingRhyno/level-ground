"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Pages", href: "/admin/pages" },
  { label: "Media", href: "/admin/files" },
];

export default function AdminNav() {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const navRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    function onPointer(e: PointerEvent) {
      if (!open) return;
      const target = e.target as Node | null;
      if (!target) return;
      if (
        menuRef.current && !menuRef.current.contains(target) &&
        buttonRef.current && !buttonRef.current.contains(target)
      ) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div
      ref={navRef}
      className="w-full flex items-stretch justify-between px-6 sticky top-0 z-40"
      style={{ backgroundColor: "var(--color-bg-secondary)" }}
    >
      {/* Left: dashboard link */}
      <Link
        href="/admin"
        className="shrink-0 font-medium uppercase transition-opacity hover:opacity-70 flex items-center py-4"
        style={{ color: "var(--color-text-heading)" }}
      >
        Admin Dashboard
      </Link>

      {/* Desktop nav items */}
      <div className="hidden md:flex gap-0 items-stretch">
        {navItems.map(({ label, href }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              style={{ color: "var(--color-text-heading)" }}
              className={`font-medium uppercase px-4 flex items-center border-b-[3px] transition-colors duration-150 ${active ? "border-(--color-brand-logo)" : "border-transparent hover:border-(--color-brand-logo)"}`}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {/* Mobile hamburger */}
      <div className="md:hidden flex items-center py-4">
        <button
          ref={buttonRef}
          aria-label="Toggle admin menu"
          aria-expanded={open}
          aria-controls="admin-mobile-menu"
          onClick={() => setOpen((s) => !s)}
          className="inline-flex items-center justify-center rounded-md p-2 hover:bg-black/10"
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
            id="admin-mobile-menu"
            ref={menuRef}
            role="menu"
            className="fixed left-0 right-0 z-40 w-full"
            style={{ top: navRef.current ? `${navRef.current.offsetTop + navRef.current.offsetHeight}px` : undefined }}
          >
            <div
              className="px-6 py-2"
              style={{ backgroundColor: "var(--color-bg-secondary)", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.08)" }}
            >
              {navItems.map(({ label, href }) => {
                const active = pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    style={{ color: "var(--color-text-heading)" }}
                    className={`block px-4 py-3 text-base font-medium uppercase rounded-md hover:bg-black/10 text-left ${active ? "bg-black/10" : ""}`}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
