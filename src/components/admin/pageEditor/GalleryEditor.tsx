"use client";
import { useState } from "react";
import type { PageSection } from "@/types/sections";
import GalleryPicker from "../GalleryPicker";

export default function GalleryEditor({
  section,
  index,
  onChange,
}: {
  section: PageSection;
  index: number;
  onChange: (s: PageSection, i: number) => void;
}) {
  const gs = section as any;
  const [pickerOpen, setPickerOpen] = useState(false);

  function update(key: string, value: any) {
    onChange({ ...section, [key]: value } as PageSection, index);
  }

  const assetCount = gs.mode === "static" ? (gs.assetIds?.length ?? 0) : null;
  const activeTagCount = gs.mode === "dynamic" ? (gs.filters?.tags?.length ?? 0) : null;
  const activeFolder = gs.mode === "dynamic" ? (gs.filters?.folder ?? null) : null;

  return (
    <div className="space-y-2">
      <label className="block text-sm">Heading</label>
      <input value={gs.heading || ""} onChange={(e) => update("heading", e.target.value)} className="w-full rounded border px-2 py-1" placeholder="Optional" />
      <label className="block text-sm">Body text</label>
      <textarea value={gs.body || ""} onChange={(e) => update("body", e.target.value)} className="w-full rounded border px-2 py-1" rows={2} placeholder="Optional" />

      <label className="block text-sm">Mode</label>
      <select
        value={gs.mode || "static"}
        onChange={(e) => {
          const mode = e.target.value;
          if (mode === "static") {
            onChange({ type: "gallery", mode: "static", layout: gs.layout, lightbox: gs.lightbox, heading: gs.heading, body: gs.body, assetIds: [] }, index);
          } else {
            onChange({ type: "gallery", mode: "dynamic", layout: gs.layout, lightbox: gs.lightbox, heading: gs.heading, body: gs.body, filters: { tags: [], folder: undefined } }, index);
          }
        }}
        className="rounded border px-2 py-1"
      >
        <option value="static">Static (explicit asset IDs)</option>
        <option value="dynamic">Dynamic (tag / folder filters)</option>
      </select>

      <div className="flex items-center gap-3 mt-1">
        <div className="text-sm text-gray-600">
          {gs.mode === "static" && (
            assetCount === 0
              ? <span className="italic text-gray-400">No images selected</span>
              : <span>{assetCount} image{assetCount !== 1 ? "s" : ""} selected</span>
          )}
          {gs.mode === "dynamic" && (
            <span>
              {activeTagCount ? `${activeTagCount} tag${activeTagCount !== 1 ? "s" : ""}` : "Any tag"}
              {activeFolder ? `, folder: ${activeFolder}` : ""}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
        >
          {gs.mode === "static" ? "Choose images\u2026" : "Edit filters\u2026"}
        </button>
      </div>

      {pickerOpen && (
        <GalleryPicker
          mode={gs.mode || "static"}
          assetIds={gs.assetIds ?? []}
          filters={gs.filters ?? {}}
          onSave={(upd) => {
            const merged = upd.assetIds !== undefined ? { assetIds: upd.assetIds } : upd;
            onChange({ ...section, ...merged } as PageSection, index);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}

      <label className="block text-sm mt-1">Layout</label>
      <select
        value={gs.layout || "grid"}
        onChange={(e) => update("layout", e.target.value)}
        className="rounded border px-2 py-1"
      >
        <option value="bento">Bento (visual blocks)</option>
        <option value="grid">Grid (uniform rows)</option>
        <option value="masonry">Masonry</option>
      </select>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={!!gs.lightbox}
          onChange={(e) => update("lightbox", e.target.checked)}
        />
        Enable lightbox
      </label>
    </div>
  );
}
