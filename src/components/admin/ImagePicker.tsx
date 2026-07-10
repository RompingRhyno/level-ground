"use client";
import { useEffect, useState } from "react";
import Image from "next/image";

type Asset = { id: string; publicUrl: string | null; filename: string | null; alt: string | null };

// ── Modal ──────────────────────────────────────────────────────────────────────

export function ImagePickerModal({
  onPick,
  onClose,
  defaultFolder,
  defaultTag,
}: {
  onPick: (url: string) => void;
  onClose: () => void;
  defaultFolder?: string;
  defaultTag?: string;
}) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [folder, setFolder] = useState<string>(defaultFolder ?? "");
  const [folders, setFolders] = useState<{ slug: string; name: string }[]>([]);
  const [allTags, setAllTags] = useState<{ slug: string; name: string }[]>([]);
  const [tag, setTag] = useState<string>(defaultTag ?? "");

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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const filtered = assets;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-gray-800">Choose image</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Close">×</button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Folder</label>
            <select value={folder} onChange={(e) => setFolder(e.target.value)} className="rounded border px-2 py-1 text-sm">
              <option value="">All</option>
              {folders.map((f) => <option key={f.slug} value={f.slug}>{f.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Tag</label>
            <select value={tag} onChange={(e) => setTag(e.target.value)} className="rounded border px-2 py-1 text-sm">
              <option value="">All</option>
              {allTags.map((t) => <option key={t.slug} value={t.slug}>{t.name}</option>)}
            </select>
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-gray-500">No assets found.</div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {filtered.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  disabled={!a.publicUrl}
                  onClick={() => { if (a.publicUrl) { onPick(a.publicUrl); onClose(); } }}
                  className="relative aspect-video rounded overflow-hidden border-2 border-transparent hover:border-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-40"
                  title={a.filename ?? a.id}
                >
                  {a.publicUrl ? (
                    <Image src={a.publicUrl} alt={a.alt ?? ""} fill sizes="120px" className="object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center text-xs text-gray-400">no preview</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Public component ────────────────────────────────────────────────────────────

export default function ImagePicker({
  value,
  onChange,
  defaultFolder,
  defaultTag,
  defaultImage,
}: {
  value: string;
  onChange: (url: string) => void;
  defaultFolder?: string;
  defaultTag?: string;
  defaultImage?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-start gap-3">
      {/* Thumbnail preview */}
      {value ? (
        <div className="relative w-36 aspect-video rounded overflow-hidden border border-gray-200 shrink-0">
          <Image src={value} alt="" fill sizes="144px" className="object-cover" />
        </div>
      ) : defaultImage ? (
        <div className="relative w-36 aspect-video rounded overflow-hidden border border-dashed border-gray-300 shrink-0">
          <Image src={defaultImage} alt="" fill sizes="144px" className="object-cover opacity-70" />
          <div className="absolute inset-x-0 bottom-0 bg-black/40 text-white text-[10px] text-center py-0.5 leading-none">auto</div>
        </div>
      ) : (
        <div className="w-36 aspect-video rounded border border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400 shrink-0">
          No image
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded border px-3 py-1 text-sm transition-colors self-start"
          style={{ backgroundColor: "white", color: "var(--color-brand-dark)", borderColor: "var(--color-brand-dark)" }}
        >
          {value ? "Change image…" : "Choose image…"}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-sm text-red-500 hover:text-red-700 self-start"
          >
            Remove
          </button>
        )}
      </div>

      {open && (
        <ImagePickerModal
          onPick={onChange}
          onClose={() => setOpen(false)}
          defaultFolder={defaultFolder}
          defaultTag={defaultTag}
        />
      )}
    </div>
  );
}
