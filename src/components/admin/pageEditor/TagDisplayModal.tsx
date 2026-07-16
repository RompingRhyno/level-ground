"use client";
import { useEffect, useState } from "react";

type TagRecord = { id: number; slug: string; name: string };

type Props = {
  selected: string[];
  suggestedSlugs?: string[];
  onSave: (tags: string[]) => void;
  onClose: () => void;
};

export default function TagDisplayModal({ selected, suggestedSlugs, onSave, onClose }: Props) {
  const [allTags, setAllTags] = useState<TagRecord[]>([]);
  const [local, setLocal] = useState<string[]>(selected);

  useEffect(() => {
    fetch("/api/tags")
      .then((r) => r.json())
      .then((data: TagRecord[]) => setAllTags(data || []))
      .catch(() => {});
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggle(slug: string) {
    setLocal((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  }

  const suggested = allTags.filter((t) => suggestedSlugs?.includes(t.slug));
  const remaining = allTags.filter((t) => !suggestedSlugs?.includes(t.slug));

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-gray-800">Select display tags</h2>
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
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {suggested.length > 0 && (
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">Suggested</div>
              <div className="flex flex-wrap gap-1.5">
                {suggested.map((t) => (
                  <button
                    key={t.slug}
                    type="button"
                    onClick={() => toggle(t.slug)}
                    className={`rounded-full px-3 py-0.5 text-sm border ${
                      local.includes(t.slug)
                        ? "bg-blue-500 text-white border-blue-500"
                        : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="text-sm font-medium text-gray-700 mb-2">All tags</div>
            {remaining.length === 0 && suggested.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No tags available</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {remaining.map((t) => (
                  <button
                    key={t.slug}
                    type="button"
                    onClick={() => toggle(t.slug)}
                    className={`rounded-full px-3 py-0.5 text-sm border ${
                      local.includes(t.slug)
                        ? "bg-blue-500 text-white border-blue-500"
                        : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t">
          <span className="text-sm text-gray-500">{local.length} selected</span>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded border px-4 py-1.5 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave(local)}
              className="rounded bg-blue-600 text-white px-4 py-1.5 text-sm hover:bg-blue-700"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}