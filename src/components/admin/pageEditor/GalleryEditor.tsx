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

type Asset = { id: string; publicUrl: string | null; filename: string | null; alt: string | null };

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
    </div>
  );
}
