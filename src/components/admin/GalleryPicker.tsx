"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";

type Asset = { id: string; publicUrl: string | null; filename: string | null; alt: string | null; mime?: string | null };
type TagRecord = { id: number; slug: string; name: string };

// ── Static picker ─────────────────────────────────────────────────────────────

function StaticPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [folder, setFolder] = useState<string>("");
  const [folders, setFolders] = useState<{ slug: string; name: string }[]>([]);
  const [tag, setTag] = useState<string>("");
  const [allTags, setAllTags] = useState<TagRecord[]>([]);

  const filteredAssets = assets.filter((a) => !a.mime?.startsWith("video/"));

  useEffect(() => {
    Promise.all([
      fetch("/api/folders").then((r) => r.json()).catch(() => []),
      fetch("/api/tags").then((r) => r.json()).catch(() => []),
    ]).then(([fData, tData]) => {
      setFolders(fData || []);
      setAllTags(tData || []);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    const q = folder ? `?folder=${encodeURIComponent(folder)}` : "";
    fetch(`/api/assets${q}`)
      .then((r) => r.json())
      .then((d) => setAssets(d || []))
      .catch(() => setAssets([]))
      .finally(() => setLoading(false));
  }, [folder]);

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Status line — top, slightly larger */}
      <div className="text-sm text-gray-600">
        {selected.length} selected — click to toggle, order is preserved
      </div>

      {/* Filter controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Folder</label>
          <select
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            className="rounded border px-2 py-1 text-sm"
          >
            <option value="">All</option>
            {folders.map((f) => (
              <option key={f.slug} value={f.slug}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Tag</label>
          <select
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            className="rounded border px-2 py-1 text-sm"
          >
            <option value="">All</option>
            {allTags.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={() => {
              const toAdd = filteredAssets.map((a) => a.id).filter((id) => !selected.includes(id));
              if (toAdd.length) onChange([...selected, ...toAdd]);
            }}
            className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={() => onChange([])}
            className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
          >
            Clear selection
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : filteredAssets.length === 0 ? (
        <div className="text-sm text-gray-500">No assets found.</div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 overflow-y-auto flex-1 pr-1">
          {filteredAssets.map((a) => {
            const isSelected = selected.includes(a.id);
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => toggle(a.id)}
                className={`relative aspect-video rounded overflow-hidden border-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                  isSelected ? "border-blue-500" : "border-transparent hover:border-gray-300"
                }`}
                title={a.filename ?? a.id}
              >
                {a.publicUrl ? (
                  <Image
                    src={a.publicUrl}
                    alt={a.alt ?? ""}
                    fill
                    sizes="120px"
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                    no preview
                  </div>
                )}
                {isSelected && (
                  <div className="absolute inset-0 bg-blue-500/20 flex items-end justify-end p-1">
                    <div className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                      {selected.indexOf(a.id) + 1}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

    </div>
  );
}

// ── Dynamic picker ────────────────────────────────────────────────────────────

function DynamicPicker({
  filters,
  onChange,
}: {
  filters: { tags?: string[]; folder?: string };
  onChange: (filters: { tags?: string[]; folder?: string }) => void;
}) {
  const [allTags, setAllTags] = useState<{ slug: string; name: string }[]>([]);
  const [folders, setFolders] = useState<{ slug: string; name: string }[]>([]);
  const [tagInput, setTagInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/tags").then((r) => r.json()).catch(() => []),
      fetch("/api/folders").then((r) => r.json()).catch(() => []),
    ]).then(([tagsData, foldersData]) => {
      setAllTags(tagsData || []);
      setFolders(foldersData || []);
    });
  }, []);

  const activeTags = filters.tags ?? [];
  const activeFolder = filters.folder ?? "";

  function toggleTag(tag: string) {
    const next = activeTags.includes(tag)
      ? activeTags.filter((t) => t !== tag)
      : [...activeTags, tag];
    onChange({ ...filters, tags: next.length ? next : undefined });
  }

  function addCustomTag() {
    const t = tagInput.trim();
    if (!t || activeTags.includes(t)) return;
    onChange({ ...filters, tags: [...activeTags, t] });
    setTagInput("");
    inputRef.current?.focus();
  }

  const suggestions = tagInput
    ? allTags.filter(
        (t) => t.name.toLowerCase().includes(tagInput.toLowerCase()) && !activeTags.includes(t.slug)
      )
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-sm font-medium text-gray-700 mb-2">Tags filter</div>
        <div className="flex flex-wrap gap-2 mb-2">
          {activeTags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => toggleTag(t)}
              className="flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 px-3 py-0.5 text-sm hover:bg-blue-200"
            >
              {t}
              <span className="font-bold leading-none ml-0.5">×</span>
            </button>
          ))}
          {activeTags.length === 0 && (
            <span className="text-sm text-gray-400 italic">No tags selected — all assets match</span>
          )}
        </div>

        {/* Known tags as toggles */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {allTags.map((t) => (
              <button
                key={t.slug}
                type="button"
                onClick={() => toggleTag(t.slug)}
                className={`rounded-full px-3 py-0.5 text-sm border ${
                  activeTags.includes(t.slug)
                    ? "bg-blue-500 text-white border-blue-500"
                    : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}

        {/* Custom tag input with suggestions */}
        <div className="relative">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); addCustomTag(); }
              }}
              placeholder="Type a tag…"
              className="rounded border px-2 py-1 text-sm flex-1"
            />
            <button
              type="button"
              onClick={addCustomTag}
              className="rounded border px-2 py-1 text-sm"
            >
              Add
            </button>
          </div>
          {suggestions.length > 0 && (
            <div className="absolute z-10 left-0 right-0 mt-1 bg-white border rounded shadow-md max-h-40 overflow-y-auto">
              {suggestions.map((t) => (
                <button
                  key={t.slug}
                  type="button"
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50"
                  onClick={() => { toggleTag(t.slug); setTagInput(""); }}
                >
                  {t.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700">Folder filter</label>
        <select
          value={activeFolder}
          onChange={(e) =>
            onChange({ ...filters, folder: e.target.value || undefined })
          }
          className="mt-1 block rounded border px-2 py-1 text-sm w-full max-w-xs"
        >
          <option value="">Any folder</option>
          {folders.map((f) => (
            <option key={f.slug} value={f.slug}>
              {f.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ── Modal shell ───────────────────────────────────────────────────────────────

export default function GalleryPicker({
  mode,
  assetIds,
  filters,
  onSave,
  onClose,
}: {
  mode: "static" | "dynamic";
  assetIds: string[];
  filters: { tags?: string[]; folder?: string };
  onSave: (update: { assetIds?: string[]; filters?: { tags?: string[]; folder?: string } }) => void;
  onClose: () => void;
}) {
  const [localIds, setLocalIds] = useState<string[]>(assetIds);
  const [localFilters, setLocalFilters] = useState(filters);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function confirm() {
    if (mode === "static") {
      onSave({ assetIds: localIds });
    } else {
      onSave({ filters: localFilters });
    }
    onClose();
  }

  const modal = (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-gray-800">
            {mode === "static" ? "Select images" : "Configure filters"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
          {mode === "static" ? (
            <StaticPicker selected={localIds} onChange={setLocalIds} />
          ) : (
            <DynamicPicker filters={localFilters} onChange={setLocalFilters} />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="rounded border px-4 py-1.5 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            className="rounded bg-blue-600 text-white px-4 py-1.5 text-sm hover:bg-blue-700"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modal, document.body);
}
