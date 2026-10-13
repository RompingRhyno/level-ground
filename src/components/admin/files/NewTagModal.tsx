"use client";

import { useEffect, useRef, useState } from "react";
import { SERVICES } from "@/lib/services";
import { useServices } from "@/components/sections/useServiceLinks";
import { api } from "./api";
import type { TagData } from "./types";

/**
 * Create a tag, filed under its service category.
 *
 * The category is not decoration: a tag's `service` is what files it under a service in the
 * gallery picker and the /projects filter (tags are the covers, services are the categories
 * above them), so an unassigned tag is invisible to both. Capturing it up front is the point of
 * this modal. Creating a *service* is a separate concern in its own modal.
 */
export default function NewTagModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (tag: TagData) => Promise<void> | void;
}) {
  const [name, setName] = useState("");
  const [service, setService] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const liveServices = useServices();
  const services = liveServices ?? SERVICES;

  useEffect(() => {
    if (!open) return;
    setName("");
    setService("");
    setError(null);
    setBusy(false);
    const t = setTimeout(() => nameRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a name.");
      return;
    }
    if (!service) {
      setError("Choose a service category.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await api<TagData>("/api/tags", {
        method: "POST",
        body: JSON.stringify({ name: trimmed, service }),
      });
      await onCreated(created);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the tag.");
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="New tag"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h2 className="mb-4 text-base font-semibold">New tag</h2>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm">Name</span>
          <input
            ref={nameRef}
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submit();
            }}
            placeholder="e.g. Basalt gravel"
            className="w-full rounded border bg-white px-3 py-2 text-sm"
          />
        </label>

        <label className="mb-4 block">
          <span className="mb-1 block text-sm">Service category</span>
          <select
            value={service}
            onChange={(event) => setService(event.target.value)}
            className="w-full rounded border bg-white px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Choose a service…
            </option>
            <optgroup label="Installation">
              {services.filter((s) => s.group === "installation").map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Maintenance">
              {services.filter((s) => s.group === "maintenance").map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </optgroup>
          </select>
        </label>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded px-3 py-1.5 text-sm admin-btn">
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={busy} className="rounded px-3 py-1.5 text-sm btn-positive">
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
