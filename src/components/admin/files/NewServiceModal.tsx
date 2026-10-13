"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "./api";

/**
 * Create a service category — the layer above the covers: every tag belongs to exactly one service,
 * which is what files it under a service in the gallery picker and the /projects filter.
 *
 * Creating a service also plants its skeleton section on the Installation or Maintenance page (the
 * API runs that cascade), so the cover chips and lightbox pills that point at the new service
 * resolve immediately instead of landing nowhere.
 */
export default function NewServiceModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (service: { slug: string; name: string; group: string }) => Promise<void> | void;
}) {
  const [name, setName] = useState("");
  const [group, setGroup] = useState<"installation" | "maintenance">("installation");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setGroup("installation");
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
    setBusy(true);
    setError(null);
    try {
      const created = await api<{ slug: string; name: string; group: string }>("/api/services", {
        method: "POST",
        body: JSON.stringify({ name: trimmed, group }),
      });
      await onCreated(created);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the service.");
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="New service"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h2 className="mb-4 text-base font-semibold">New service</h2>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm">Name</span>
          <input
            ref={nameRef}
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submit();
            }}
            placeholder="e.g. Processes"
            className="w-full rounded border bg-white px-3 py-2 text-sm"
          />
        </label>

        <label className="mb-4 block">
          <span className="mb-1 block text-sm">Lives under</span>
          <select
            value={group}
            onChange={(event) => setGroup(event.target.value as "installation" | "maintenance")}
            className="w-full rounded border bg-white px-3 py-2 text-sm"
          >
            <option value="installation">Installation</option>
            <option value="maintenance">Maintenance</option>
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
