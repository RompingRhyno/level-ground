"use client";
import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import AlertDialog from "@/components/ui/AlertDialog";
import { useConfirm } from "@/components/admin/useConfirm";
import type { PageConfig } from "@/types/sections";

function slugify(label: string) {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export default function AdminPagesClient({ initialPages }: { initialPages: Pick<PageConfig, "slug" | "label">[] }) {
  const router = useRouter();
  const { confirm, dialogProps } = useConfirm();

  const [pages, setPages] = useState(initialPages);
  const [savedOrder, setSavedOrder] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // New page modal state
  const [showNewPage, setShowNewPage] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  function openNewPage() {
    setNewLabel("");
    setNewSlug("");
    setSlugManual(false);
    setCreateError(null);
    setShowNewPage(true);
  }

  function handleLabelChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setNewLabel(val);
    if (!slugManual) setNewSlug(slugify(val));
  }

  function handleSlugChange(e: React.ChangeEvent<HTMLInputElement>) {
    setNewSlug(e.target.value);
    setSlugManual(true);
  }

  async function handleCreate() {
    const label = newLabel.trim();
    const slug = newSlug.trim();
    if (!label || !slug) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, slug, sections: [] }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCreateError(data.error || "Failed to create page");
        setCreating(false);
        return;
      }
      const created = await res.json();
      setPages((prev) => [...prev, { slug: created.slug, label: created.label }]);
      setShowNewPage(false);
    } catch {
      setCreateError("Failed to create page");
    } finally {
      setCreating(false);
    }
  }

  async function handleMove(e: React.MouseEvent, index: number, direction: "up" | "down") {
    e.stopPropagation();
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= pages.length) return;
    const newPages = [...pages];
    [newPages[index], newPages[targetIndex]] = [newPages[targetIndex], newPages[index]];
    setPages(newPages);
    const res = await fetch("/api/pages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slugs: newPages.map((p) => p.slug) }),
    });
    if (res.ok) {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      setSavedOrder(true);
      savedTimerRef.current = setTimeout(() => setSavedOrder(false), 2000);
    }
  }

  async function handleDelete(e: React.MouseEvent, slug: string, label: string) {
    e.stopPropagation();
    const ok = await confirm(
      `Delete "${label}"?`,
      "This will permanently delete the page and all its content. This cannot be undone.",
      "danger",
      "Delete"
    );
    if (!ok) return;
    const res = await fetch(`/api/pages/${slug}`, { method: "DELETE" });
    if (res.ok) {
      setPages((prev) => prev.filter((p) => p.slug !== slug));
    }
  }
  return (
    <div>
      <AlertDialog {...dialogProps} />

      <div style={{ width: '100vw', marginLeft: 'calc(50% - 50vw)', padding: '1rem 0' }}>
        <div className="max-w-7xl mx-auto px-4">
          {/* Action bar */}
          <div className="flex items-center justify-end gap-3 mb-6">
            {savedOrder && (
              <span className="text-sm" style={{ color: "var(--color-brand-dark)" }}>Saved</span>
            )}
            <button onClick={openNewPage} className="px-3 py-1.5 rounded text-sm btn-positive">
              New Page
            </button>
          </div>

          {/* Pages list */}
          <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--color-brand-dark)", backgroundColor: "white" }}>
            {/* Table header */}
            <div
              className="grid grid-cols-[1fr_1fr_5rem_5rem] justify-items-start px-4 py-2 text-sm font-semibold uppercase tracking-wide"
                style={{ backgroundColor: "white", color: "var(--color-brand-dark)" }}
            >
              <span className="text-left">Label</span>
              <span className="text-left">Slug</span>
              <span />
              <span />
            </div>

            {pages.length === 0 && (
              <div className="px-4 py-6 text-sm text-center" style={{ color: "var(--color-text-primary)" }}>
                No pages yet.
              </div>
            )}

            {pages.map((page, i) => (
              <div
                key={page.slug}
                onClick={() => router.push(`/admin/pages/${page.slug}`)}
                className="grid grid-cols-[1fr_1fr_5rem_5rem] justify-items-start items-center px-4 py-3 cursor-pointer transition-colors duration-100"
                style={{ borderTop: "1px solid var(--color-brand-dark)" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--btn-default-hover-bg)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "")}
              >
                <span className="font-normal" style={{ color: "var(--color-brand-dark)" }}>{page.label}</span>
                <span className="text-sm" style={{ color: "var(--color-brand-dark)" }}>{page.slug}</span>
                <div className="flex items-center gap-1 mr-2">
                  <button
                    onClick={(e) => handleMove(e, i, "up")}
                    disabled={i === 0}
                    className="px-2 py-1 text-sm rounded admin-btn disabled:opacity-30"
                    title="Move up"
                  >↑</button>
                  <button
                    onClick={(e) => handleMove(e, i, "down")}
                    disabled={i === pages.length - 1}
                    className="px-2 py-1 text-sm rounded admin-btn disabled:opacity-30"
                    title="Move down"
                  >↓</button>
                </div>
                <button
                  onClick={(e) => handleDelete(e, page.slug, page.label)}
                  className="px-2 py-1 rounded text-sm btn-negative justify-self-end"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* New Page modal */}
      {showNewPage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowNewPage(false)} />
          <div
            className="relative rounded-lg shadow-lg w-full mx-4 p-6"
            style={{ maxWidth: 440, backgroundColor: "var(--color-bg-primary)" }}
          >
            <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--color-text-heading)" }}>
              New Page
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-text-primary)" }}>
                  Label
                </label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={handleLabelChange}
                  placeholder="e.g. About Us"
                  className="w-full px-3 py-2 rounded border text-sm"
                  style={{
                    borderColor: "var(--color-bg-secondary)",
                    backgroundColor: "var(--color-bg-primary)",
                    color: "var(--color-text-primary)",
                  }}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowNewPage(false); }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-text-primary)" }}>
                  Slug
                </label>
                <input
                  type="text"
                  value={newSlug}
                  onChange={handleSlugChange}
                  placeholder="e.g. about-us"
                  className="w-full px-3 py-2 rounded border text-sm"
                  style={{
                    borderColor: "var(--color-bg-secondary)",
                    backgroundColor: "var(--color-bg-primary)",
                    color: "var(--color-text-primary)",
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowNewPage(false); }}
                />
                <p className="mt-1 text-xs" style={{ color: "var(--color-text-primary)", opacity: 0.7 }}>
                  Auto-derived from label. Edit to override.
                </p>
              </div>

              {createError && (
                <p className="text-sm" style={{ color: "var(--btn-negative-bg)" }}>{createError}</p>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowNewPage(false)}
                className="px-3 py-1.5 rounded text-sm admin-btn"
                disabled={creating}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newLabel.trim() || !newSlug.trim()}
                className="px-3 py-1.5 rounded text-sm btn-positive disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? "Creating…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
