"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type MenuItem = { label: string; onSelect: () => void; danger?: boolean; disabled?: boolean };

const MENU_WIDTH = 176; // 11rem
const VIEWPORT_MARGIN = 8;

/**
 * Minimal dropdown menu for card actions (kebab).
 *
 * Rendered in a portal with fixed positioning: cards use `overflow-hidden` for their rounded
 * corners, which would otherwise clip the list. Re-derives its position when opened and closes
 * on scroll/resize so it never detaches from the trigger.
 */
export default function Menu({
  items,
  label = "Actions",
  align = "right",
  className = "",
  buttonClassName = "",
  buttonContent,
}: {
  items: MenuItem[];
  label?: string;
  align?: "left" | "right";
  className?: string;
  buttonClassName?: string;
  buttonContent?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; up: boolean } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const place = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const estimatedHeight = items.length * 34 + 8;
    const openUpward = rect.bottom + estimatedHeight + VIEWPORT_MARGIN > window.innerHeight;

    let left = align === "right" ? rect.right - MENU_WIDTH : rect.left;
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN));

    setPosition({
      top: openUpward ? rect.top - VIEWPORT_MARGIN : rect.bottom + VIEWPORT_MARGIN,
      left,
      up: openUpward,
    });
  }, [align, items.length]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onViewportChange() {
      setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    };
  }, [open]);

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className={buttonClassName || "rounded px-1.5 py-1 hover:bg-white/20"}
      >
        {buttonContent ?? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        )}
      </button>

      {open && position && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{
                position: "fixed",
                top: position.top,
                left: position.left,
                width: MENU_WIDTH,
                transform: position.up ? "translateY(-100%)" : undefined,
              }}
              className="z-[70] rounded-md border bg-white py-1 shadow-lg"
            >
              {items.map((item) => (
                <button
                  key={item.label}
                  role="menuitem"
                  type="button"
                  disabled={item.disabled}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setOpen(false);
                    item.onSelect();
                  }}
                  className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 disabled:opacity-40 ${
                    item.danger ? "text-(--btn-negative-bg)" : "text-(--color-brand-dark)"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
