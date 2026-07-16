"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { PageSection } from "@/types/sections";
import GalleryPicker from "../GalleryPicker";
import RichContentEditable from "./RichContentEditable";
import TagDisplayModal from "./TagDisplayModal";

type Asset = { id: string; publicUrl: string | null; filename: string | null; alt: string | null; folder?: string | null; mime?: string | null };

function SortableThumbnail({
  id,
  asset,
  onRemove,
}: {
  id: string;
  asset: Asset | undefined;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative w-36 aspect-video shrink-0 rounded overflow-hidden border border-gray-200 group"
    >
      <div
        {...attributes}
        {...listeners}
        className="absolute inset-0 cursor-grab active:cursor-grabbing z-10"
      />
      {asset?.publicUrl ? (
        <Image src={asset.publicUrl} alt={asset.alt ?? ""} fill sizes="80px" className="object-cover" />
      ) : (
        <div className="w-full h-full bg-gray-100 flex items-center justify-center text-xs text-gray-400">
          {asset ? "no preview" : "…"}
        </div>
      )}
      <button
        type="button"
        onClick={() => onRemove(id)}
        className="absolute top-0.5 right-0.5 z-20 w-5 h-5 rounded-full bg-black/60 text-white text-xs leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
        aria-label="Remove image"
      >
        ×
      </button>
    </div>
  );
}

function ThumbnailPreview({ asset }: { asset: Asset | undefined }) {
  return (
    <div className="relative w-36 aspect-video rounded overflow-hidden border border-blue-400 shadow-lg">
      {asset?.publicUrl ? (
        <Image src={asset.publicUrl} alt={asset.alt ?? ""} fill sizes="144px" className="object-cover" />
      ) : (
        <div className="w-full h-full bg-gray-100" />
      )}
    </div>
  );
}

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
  const [assetMap, setAssetMap] = useState<Record<string, Asset>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [suggestedTagSlugs, setSuggestedTagSlugs] = useState<string[]>([]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    fetch("/api/assets")
      .then((r) => r.json())
      .then((data: Asset[]) => {
        const map: Record<string, Asset> = {};
        for (const a of data) map[a.id] = a;
        setAssetMap(map);
      })
      .catch(() => {});
  }, []);

  // Compute suggested tags from folders relevant to current gallery config
  useEffect(() => {
    let folderSlugs: string[] = [];

    if (gs.mode === "static") {
      const ids: string[] = gs.assetIds ?? [];
      if (!ids.length) { setSuggestedTagSlugs([]); return; }
      folderSlugs = [...new Set(
        ids.map((id: string) => assetMap[id]?.folder).filter(Boolean)
      )] as string[];
    } else {
      // Dynamic: derive folders from current filters
      const filterFolder = gs.filters?.folder;
      const filterTags = gs.filters?.tags ?? [];
      if (filterFolder) {
        folderSlugs = [filterFolder];
      } else if (filterTags.length) {
        // Need to fetch folders matching these tags
        fetch("/api/folders")
          .then((r) => r.json())
          .then((folders: { slug: string; tags: string[] }[]) => {
            const matching = folders.filter((f) =>
              filterTags.some((t: string) => f.tags.includes(t))
            );
            const slugs = [...new Set(matching.map((f) => f.slug))];
            if (!slugs.length) { setSuggestedTagSlugs([]); return; }
            const tagSlugs = [...new Set(matching.flatMap((f) => f.tags))];
            setSuggestedTagSlugs(tagSlugs);
          })
          .catch(() => setSuggestedTagSlugs([]));
        return;
      } else {
        // No filters — fetch all folders
        fetch("/api/folders")
          .then((r) => r.json())
          .then((folders: { slug: string; tags: string[] }[]) => {
            const tagSlugs = [...new Set(folders.flatMap((f) => f.tags))];
            setSuggestedTagSlugs(tagSlugs);
          })
          .catch(() => setSuggestedTagSlugs([]));
        return;
      }
    }

    if (!folderSlugs.length) { setSuggestedTagSlugs([]); return; }

    fetch("/api/folders")
      .then((r) => r.json())
      .then((folders: { slug: string; tags: string[] }[]) => {
        const relevant = folders.filter((f) => folderSlugs.includes(f.slug));
        const tagSlugs = [...new Set(relevant.flatMap((f) => f.tags))];
        setSuggestedTagSlugs(tagSlugs);
      })
      .catch(() => setSuggestedTagSlugs([]));
  }, [gs.mode, gs.assetIds, gs.filters?.folder, JSON.stringify(gs.filters?.tags), assetMap]);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids: string[] = gs.assetIds ?? [];
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange({ ...section, assetIds: arrayMove(ids, oldIndex, newIndex) } as PageSection, index);
  }

  function removeAsset(id: string) {
    const ids: string[] = gs.assetIds ?? [];
    onChange({ ...section, assetIds: ids.filter((x) => x !== id) } as PageSection, index);
  }

  function update(key: string, value: any) {
    onChange({ ...section, [key]: value } as PageSection, index);
  }

  const assetCount = gs.mode === "static" ? (gs.assetIds?.length ?? 0) : null;
  const activeTagCount = gs.mode === "dynamic" ? (gs.filters?.tags?.length ?? 0) : null;
  const activeFolder = gs.mode === "dynamic" ? (gs.filters?.folder ?? null) : null;
  const assetIds: string[] = gs.assetIds ?? [];

  const tagDisplay = gs.tagDisplay ?? { enabled: false, mode: "manual" as const, tags: [] };
  const isStatic = gs.mode === "static";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <label className="block text-sm">Heading</label>
        <RichContentEditable value={gs.heading || ""} onChange={(val) => update("heading", val)} className="w-full" placeholder="Optional" />
      </div>

      <div className="space-y-1">
        <label className="block text-sm">Body text</label>
        <textarea value={gs.body || ""} onChange={(e) => update("body", e.target.value)} className="w-full rounded border px-2 py-1" rows={2} placeholder="Optional" />
      </div>

      <div className="space-y-1">
        <label className="block text-sm">Mode</label>
        <select
          value={gs.mode || "static"}
          onChange={(e) => {
            const mode = e.target.value;
            if (mode === "static") {
              onChange({ type: "gallery", mode: "static", layout: gs.layout, lightbox: gs.lightbox, heading: gs.heading, body: gs.body, assetIds: [], tagDisplay: gs.tagDisplay }, index);
            } else {
              onChange({ type: "gallery", mode: "dynamic", layout: gs.layout, lightbox: gs.lightbox, heading: gs.heading, body: gs.body, filters: { tags: [], folder: undefined }, tagDisplay: gs.tagDisplay }, index);
            }
          }}
          className="rounded border px-2 py-1"
        >
          <option value="static">Static (explicit asset IDs)</option>
          <option value="dynamic">Dynamic (tag / folder filters)</option>
        </select>
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-3">
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
            className="rounded border px-3 py-1 text-sm transition-colors"
            style={{ backgroundColor: "white", color: "var(--color-brand-dark)", borderColor: "var(--color-brand-dark)" }}
          >
            {gs.mode === "static" ? "Choose images\u2026" : "Edit filters\u2026"}
          </button>
        </div>

        {/* Sortable thumbnail strip — static mode only */}
        {gs.mode === "static" && assetIds.length > 0 && (
          <p className="text-xs" style={{ color: "var(--color-brand-dark)" }}>Drag to reorder · hover to remove</p>
        )}
        {gs.mode === "static" && assetIds.length > 0 && (
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={assetIds} strategy={rectSortingStrategy}>
              <div className="flex flex-wrap gap-2">
                {assetIds.map((id) => (
                  <SortableThumbnail
                    key={id}
                    id={id}
                    asset={assetMap[id]}
                    onRemove={removeAsset}
                  />
                ))}
              </div>
            </SortableContext>
          <DragOverlay>
            {activeId ? (
              <div className="relative w-36 aspect-video">
                <ThumbnailPreview asset={assetMap[activeId]} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
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

      <div className="space-y-1">
        <label className="block text-sm">Layout</label>
        <select
          value={gs.layout || "grid"}
          onChange={(e) => update("layout", e.target.value)}
          className="rounded border px-2 py-1"
        >
          <option value="bento">Bento (visual blocks)</option>
          <option value="grid">Grid (uniform rows)</option>
          <option value="masonry">Masonry</option>
        </select>
      </div>

      <div className="space-y-1">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!gs.lightbox}
            onChange={(e) => update("lightbox", e.target.checked)}
          />
          Enable lightbox
        </label>
      </div>

      {/* ── Tag Display ─────────────────────────────────────────────── */}
      <div className="space-y-1">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={tagDisplay.enabled}
            onChange={(e) => {
              const enabled = e.target.checked;
              if (enabled) {
                update("tagDisplay", { enabled: true, mode: isStatic ? "manual" : "auto", tags: [] });
              } else {
                update("tagDisplay", undefined);
              }
            }}
          />
          Display tags
        </label>

        {tagDisplay.enabled && (
          <div className="ml-6 space-y-3">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="tagDisplayMode"
                  checked={tagDisplay.mode === "auto"}
                  disabled={isStatic}
                  onChange={() => update("tagDisplay", { ...tagDisplay, mode: "auto", tags: [] })}
                />
                Auto
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="tagDisplayMode"
                  checked={tagDisplay.mode === "manual"}
                  onChange={() => update("tagDisplay", { ...tagDisplay, mode: "manual" })}
                />
                Manually select…
              </label>
            </div>

            {tagDisplay.mode === "manual" && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">
                  {(tagDisplay.tags?.length ?? 0) === 0
                    ? <span className="italic text-gray-400">No tags selected</span>
                    : <span>{tagDisplay.tags!.length} tag{tagDisplay.tags!.length !== 1 ? "s" : ""} selected</span>
                  }
                </span>
                <button
                  type="button"
                  onClick={() => setTagModalOpen(true)}
                  className="rounded border px-3 py-1 text-sm transition-colors"
                  style={{ backgroundColor: "white", color: "var(--color-brand-dark)", borderColor: "var(--color-brand-dark)" }}
                >
                  Choose tags…
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {tagModalOpen && (
        <TagDisplayModal
          selected={tagDisplay.tags ?? []}
          suggestedSlugs={suggestedTagSlugs}
          onSave={(tags) => {
            update("tagDisplay", { ...tagDisplay, tags });
            setTagModalOpen(false);
          }}
          onClose={() => setTagModalOpen(false)}
        />
      )}
    </div>
  );
}