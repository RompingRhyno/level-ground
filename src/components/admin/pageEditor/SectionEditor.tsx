"use client";
import { useState, useEffect, useRef } from "react";
import type { PageSection } from "@/types/sections";
import AlertDialog from "@/components/ui/AlertDialog";
import { useConfirm } from "../useConfirm";
import GalleryEditor from "./GalleryEditor";
import ContactEditor from "./ContactEditor";
import SectionPreview from "./SectionPreview";
import ImagePicker, { ImagePickerModal } from "../ImagePicker";
import VideoPicker from "../VideoPicker";
import RichContentEditable from "./RichContentEditable";
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

type EntityItem = { slug: string; name: string; createdAt?: string };

const SORT_MODES = [
  { label: "Custom", value: "custom" },
  { label: "Latest", value: "latest" },
  { label: "Earliest", value: "earliest" },
  { label: "A\u2013Z", value: "alphabetical" },
] as const;

type SortMode = typeof SORT_MODES[number]["value"];

function sortItems(items: EntityItem[], mode: string, entityOrder?: string[]): EntityItem[] {
  const arr = [...items];
  if (mode === "custom" && entityOrder?.length) {
    const orderMap = new Map(entityOrder.map((s, i) => [s, i]));
    arr.sort((a, b) => (orderMap.get(a.slug) ?? arr.length) - (orderMap.get(b.slug) ?? arr.length));
  } else if (mode === "latest") {
    arr.sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
  } else if (mode === "earliest") {
    arr.sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());
  }
  return arr;
}

function SortableEntityCard({
  item,
  imageUrl,
  defaultImage,
  onChangeImage,
  collectionSource,
}: {
  item: EntityItem;
  imageUrl?: string;
  defaultImage?: string;
  onChangeImage: (url: string) => void;
  collectionSource: string;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.slug });

  const displayImage = imageUrl || defaultImage;
  const isCustom = !!imageUrl;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
      }}
      className="border rounded-lg overflow-hidden flex flex-col"
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="flex items-center justify-center py-1.5 cursor-grab active:cursor-grabbing select-none"
        style={{ backgroundColor: "var(--color-bg-secondary)", borderBottom: "1px solid var(--color-border)" }}
        title="Drag to reorder"
      >
        <svg width="16" height="10" viewBox="0 0 16 10" fill="none" aria-hidden={true}>
          <rect y="0" width="16" height="2" rx="1" fill="currentColor" opacity="0.35" />
          <rect y="4" width="16" height="2" rx="1" fill="currentColor" opacity="0.35" />
          <rect y="8" width="16" height="2" rx="1" fill="currentColor" opacity="0.35" />
        </svg>
      </div>

      {/* Image area – click to change */}
      <div
        className="relative w-full group cursor-pointer"
        style={{ aspectRatio: "16/9" }}
        onClick={() => setPickerOpen(true)}
      >
        {displayImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayImage}
            alt={item.name}
            className={`absolute inset-0 w-full h-full object-cover${!isCustom ? " opacity-70" : ""}`}
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center text-xs"
            style={{ backgroundColor: "var(--color-bg-secondary)", color: "var(--color-text-muted)" }}
          >
            No image
          </div>
        )}
        {!isCustom && displayImage && (
          <div className="absolute inset-x-0 bottom-0 bg-black/40 text-white text-[10px] text-center py-0.5 leading-none">
            auto
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <span className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 px-2 py-1 rounded">
            Change
          </span>
        </div>
      </div>

      {/* Name bar */}
      <div
        className="px-2 py-1.5 flex items-center justify-between bg-white"
        style={{ borderTop: "1px solid var(--color-border)" }}
      >
        <span className="text-xs font-medium truncate" style={{ color: "var(--color-text-heading)" }}>
          {item.name}
        </span>
        {isCustom && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChangeImage(""); }}
            className="ml-1 text-xs shrink-0"
            style={{ color: "var(--color-text-muted)" }}
            title="Reset to auto"
          >
            ×
          </button>
        )}
      </div>

      {pickerOpen && (
        <ImagePickerModal
          onPick={(url: string) => { onChangeImage(url); setPickerOpen(false); }}
          onClose={() => setPickerOpen(false)}
          defaultFolder={collectionSource === "folders" ? item.slug : undefined}
          defaultTag={collectionSource === "tags" ? item.slug : undefined}
        />
      )}
    </div>
  );
}

function EntityCardOverlay({
  imageUrl,
  defaultImage,
  name,
}: {
  imageUrl?: string;
  defaultImage?: string;
  name: string;
}) {
  const displayImage = imageUrl || defaultImage;
  return (
    <div
      className="border rounded-lg overflow-hidden shadow-xl"
      style={{ borderColor: "var(--color-brand-dark)" }}
    >
      <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
        {displayImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={displayImage} alt={name} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ backgroundColor: "var(--color-bg-secondary)" }} />
        )}
      </div>
      <div
        className="px-2 py-1.5"
        style={{ backgroundColor: "white", borderTop: "1px solid var(--color-brand-dark)" }}
      >
        <span className="text-xs font-medium" style={{ color: "var(--color-text-heading)" }}>{name}</span>
      </div>
    </div>
  );
}

const SECTION_LABELS: Record<string, string> = {
  hero: "Hero",
  twoColumn: "Two Column",
  banner: "Banner",
  services: "Services",
  gallery: "Gallery",
  cta: "CTA",
  video: "Video",
  contact: "Contact Form",
  "collection-index": "Collection Index",
  "collection-item": "Collection Item",
};

export default function SectionEditor({
  section,
  index,
  allSections,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  section: PageSection;
  index: number;
  allSections?: PageSection[];
  onChange: (s: PageSection, i: number) => void;
  onRemove: (i: number) => void;
  onMoveUp: (i: number) => void;
  onMoveDown: (i: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { confirm, dialogProps } = useConfirm();
  const type = section.type;

  const [collectionFolders, setCollectionFolders] = useState<EntityItem[]>([]);
  const [collectionTags, setCollectionTags] = useState<EntityItem[]>([]);
  const [displayItems, setDisplayItems] = useState<EntityItem[]>([]);
  const [activeEntitySlug, setActiveEntitySlug] = useState<string | null>(null);
  const entityInitialized = useRef(false);
  const [collectionDefaultImages, setCollectionDefaultImages] = useState<Record<string, string>>({});
  const [pagesList, setPagesList] = useState<{ slug: string; label: string; type?: string }[]>([]);

  const collectionSource: string = (section as any).source ?? "folders";

  useEffect(() => {
    if (type !== "collection-index") return;
    if (collectionSource === "folders") {
      fetch("/api/folders")
        .then((r) => r.json())
        .then((d) => setCollectionFolders(d || []))
        .catch(() => {});
    } else if (collectionSource === "tags") {
      fetch("/api/tags")
        .then((r) => r.json())
        .then((d) => setCollectionTags(d || []))
        .catch(() => {});
    }
  }, [type, collectionSource]);

  useEffect(() => {
    // fetch available pages for link dropdowns
    let cancelled = false;
    fetch("/api/pages")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setPagesList(data as any);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (type !== "collection-index") return;
    const items = collectionSource === "folders" ? collectionFolders : collectionTags;
    if (!items.length) return;
    const param = collectionSource === "folders" ? "folder" : "tag";
    let cancelled = false;
    Promise.all(
      items.map((item) =>
        fetch(`/api/assets?${param}=${encodeURIComponent(item.slug)}`)
          .then((r) => r.json())
          .then((assets: any[]) => {
            const first = assets.find(
              (a: any) => a.publicUrl && (!a.mime || a.mime.startsWith("image/"))
            );
            return [item.slug, first?.publicUrl] as [string, string | undefined];
          })
          .catch(() => [item.slug, undefined] as [string, undefined])
      )
    ).then((entries) => {
      if (!cancelled) {
        setCollectionDefaultImages(
          Object.fromEntries(entries.filter(([, v]) => v) as [string, string][])
        );
      }
    });
    return () => { cancelled = true; };
  }, [type, collectionSource, collectionFolders, collectionTags]);

  // Initialize display order once when folder/tag list first loads
  useEffect(() => {
    if (type !== "collection-index") return;
    const items = collectionSource === "folders" ? collectionFolders : collectionTags;
    if (!items.length) return;
    if (entityInitialized.current) return;
    entityInitialized.current = true;
    const mode = (section as any).sortMode ?? "alphabetical";
    const order = (section as any).entityOrder as string[] | undefined;
    setDisplayItems(sortItems(items, mode, order));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, collectionSource, collectionFolders, collectionTags]);

  const entitySensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleSortModeChange(newMode: SortMode) {
    const rawItems = collectionSource === "folders" ? collectionFolders : collectionTags;
    if (newMode === "custom") {
      const currentSlugs = displayItems.map((i) => i.slug);
      onChange({ ...section, sortMode: "custom", entityOrder: currentSlugs } as unknown as PageSection, index);
    } else {
      const newItems = sortItems(rawItems, newMode, undefined);
      setDisplayItems(newItems);
      const { entityOrder: _drop, ...rest } = section as any;
      onChange({ ...rest, sortMode: newMode } as unknown as PageSection, index);
    }
  }

  function handleEntityDragStart(event: DragStartEvent) {
    setActiveEntitySlug(event.active.id as string);
  }

  function handleEntityDragEnd(event: DragEndEvent) {
    setActiveEntitySlug(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = displayItems.findIndex((i) => i.slug === active.id);
    const newIndex = displayItems.findIndex((i) => i.slug === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const newItems = arrayMove(displayItems, oldIndex, newIndex);
    setDisplayItems(newItems);
    onChange(
      { ...section, sortMode: "custom", entityOrder: newItems.map((i) => i.slug) } as unknown as PageSection,
      index
    );
  }

  function update(key: string, value: any) {
    onChange({ ...section, [key]: value } as PageSection, index);
  }

  return (
    <div className="border rounded overflow-hidden" style={{ backgroundColor: "var(--color-bg-secondary)", borderColor: "var(--color-brand-dark)" }}>
      <AlertDialog {...dialogProps} />

      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ backgroundColor: "white", color: "var(--color-brand-dark)", borderColor: "var(--color-brand-dark)" }}>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-2 text-sm font-medium flex-1 text-left"
        >
          <span className="text-xs opacity-50">{expanded ? "▼" : "▶"}</span>
          <span>{SECTION_LABELS[type] ?? type}</span>
        </button>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onMoveUp(index)} className="px-2 py-1 text-sm rounded admin-btn" title="Move up">↑</button>
          <button type="button" onClick={() => onMoveDown(index)} className="px-2 py-1 text-sm rounded admin-btn" title="Move down">↓</button>
          <button type="button" onClick={async () => { if (await confirm(`Remove ${SECTION_LABELS[type] ?? type} section?`, "This section will be permanently removed from the page.", "danger", "Remove")) onRemove(index); }} className="px-2 py-1 text-sm rounded btn-negative">Remove</button>
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="section-fields" style={{ backgroundColor: "var(--color-editor-bg)" }}>
          <div className="editor-form max-w-6xl mx-auto px-4 py-4 space-y-6">
          {type === "hero" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="block text-sm">Heading</label>
                <RichContentEditable value={(section as any).heading || ""} onChange={(val) => update("heading", val)} className="w-full" />
              </div>

              <div className="space-y-1">
                <label className="block text-sm">Subheading</label>
                <input value={(section as any).subheading || ""} onChange={(e) => update("subheading", e.target.value)} className="w-full rounded border px-2 py-1" />
              </div>

              <div className="space-y-1">
                <label className="block text-sm">Button text</label>
                <input value={(section as any).buttonText || ""} onChange={(e) => update("buttonText", e.target.value)} className="w-full rounded border px-2 py-1" />
              </div>

              <div className="space-y-1">
                <label className="block text-sm">Button link</label>
                <select
                  value={(section as any).buttonHref || ""}
                  onChange={(e) => update("buttonHref", e.target.value)}
                  className="w-full rounded border px-2 py-1"
                >
                  <option value="">(none)</option>
                  {pagesList.filter(p => p.type === undefined || p.type === 'page').map((p) => (
                    <option key={p.slug} value={`/${p.slug}`}>{p.label || p.slug}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-sm">Image</label>
                <ImagePicker value={(section as any).image || ""} onChange={(url) => update("image", url)} />
              </div>
            </div>
          )}

          {type === "twoColumn" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="block text-sm">Title</label>
                <input value={(section as any).title || ""} onChange={(e) => update("title", e.target.value)} className="w-full rounded border px-2 py-1" />
              </div>
              <div className="space-y-1">
                <label className="block text-sm">Body</label>
                <textarea value={(section as any).body || ""} onChange={(e) => update("body", e.target.value)} className="w-full rounded border px-2 py-1" />
              </div>
              <div className="space-y-1">
                <label className="block text-sm">Image</label>
                <ImagePicker value={(section as any).image || ""} onChange={(url) => update("image", url)} />
              </div>
            </div>
          )}

          {type === "banner" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="block text-sm">Heading</label>
                <RichContentEditable value={(section as any).heading || ""} onChange={(val) => update("heading", val)} className="w-full" />
              </div>
              <div className="space-y-1">
                <label className="block text-sm">Subheading</label>
                <input value={(section as any).subheading || ""} onChange={(e) => update("subheading", e.target.value)} className="w-full rounded border px-2 py-1" />
              </div>
              <div className="space-y-1">
                <label className="block text-sm">Image</label>
                <ImagePicker value={(section as any).image || ""} onChange={(url) => update("image", url)} />
              </div>
              <div className="space-y-1">
                <label className="block text-sm">Overlay opacity (0-1)</label>
                <input value={(section as any).overlayOpacity ?? ""} onChange={(e) => update("overlayOpacity", Number(e.target.value))} className="w-full rounded border px-2 py-1" />
              </div>
            </div>
          )}

          {type === "gallery" && (
            <GalleryEditor section={section} index={index} onChange={onChange} />
          )}

          {type === "contact" && (
            <ContactEditor section={section} index={index} onChange={onChange} />
          )}

          {type === "video" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="block text-sm">Heading</label>
                <RichContentEditable value={(section as any).heading || ""} onChange={(val) => update("heading", val)} className="w-full" />
              </div>
              <div className="space-y-1">
                <label className="block text-sm">Subheading</label>
                <input value={(section as any).subheading || ""} onChange={(e) => update("subheading", e.target.value)} className="w-full rounded border px-2 py-1" />
              </div>
              <div className="space-y-1">
                <label className="block text-sm">Video</label>
                <VideoPicker value={(section as any).videoUrl || ""} onChange={(url) => update("videoUrl", url)} />
              </div>
            </div>
          )}

          {type === "services" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="block text-sm">Heading</label>
                <RichContentEditable value={(section as any).heading || ""} onChange={(val) => update("heading", val)} className="w-full" />
              </div>
              <div className="space-y-1">
                <label className="block text-sm">Body text</label>
                <textarea value={(section as any).bodyText || ""} onChange={(e) => update("bodyText", e.target.value)} className="w-full rounded border px-2 py-1" />
              </div>
              <div className="field-group">
                <div className="font-medium text-sm mb-1">Services</div>
                {((section as any).services || []).map((s: any, si: number) => (
                  <div key={si} className="mt-3 rounded border p-2 space-y-2" style={{ backgroundColor: "var(--color-editor-bg)" }}>
                    <div className="flex gap-2 items-center">
                      <input value={s.title} onChange={(e) => {
                        const services = [...(section as any).services];
                        services[si] = { ...services[si], title: e.target.value };
                        update("services", services);
                      }} className="rounded border px-2 py-1 flex-1" placeholder="Title" />
                      <select value={s.href || ""} onChange={(e) => {
                        const services = [...(section as any).services];
                        services[si] = { ...services[si], href: e.target.value };
                        update("services", services);
                      }} className="rounded border px-2 py-1 flex-1">
                        <option value="">(none)</option>
                        {pagesList.filter(p => p.type === undefined || p.type === 'page').map((p) => (
                          <option key={p.slug} value={`/${p.slug}`}>{p.label || p.slug}</option>
                        ))}
                      </select>
                      <button onClick={() => {
                        const services = [...(section as any).services];
                        services.splice(si, 1);
                        update("services", services);
                      }} className="text-sm btn-negative px-2 py-1 rounded shrink-0">Remove</button>
                    </div>
                    <ImagePicker
                      value={s.image || ""}
                      onChange={(url) => {
                        const services = [...(section as any).services];
                        services[si] = { ...services[si], image: url };
                        update("services", services);
                      }}
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const services = [...((section as any).services || []), { title: "", image: "", href: "" }];
                    update("services", services);
                  }}
                  className="mt-2 rounded border px-3 py-1 text-sm transition-colors self-start"
                  style={{ backgroundColor: "white", color: "var(--color-brand-dark)", borderColor: "var(--color-brand-dark)" }}
                >
                  Add service
                </button>
              </div>
            </div>
          )}

          {type === "collection-index" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="block text-sm">Heading</label>
                <RichContentEditable
                  value={(section as any).heading || ""}
                  onChange={(val) => update("heading", val)}
                  className="w-full"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm">Mode</label>
                <select
                  value={(section as any).mode || "primary"}
                  onChange={(e) => update("mode", e.target.value)}
                  className="rounded border px-2 py-1"
                  style={{ backgroundColor: "white", color: "var(--color-brand-dark)", borderColor: "var(--color-brand-dark)" }}
                >
                  <option value="primary">Primary — owns routing</option>
                  <option value="reference">Reference — display only</option>
                </select>
                {((section as any).mode ?? "primary") === "reference" && (
                  <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                    Uses routing from primary collection index on this page.
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <label className="block text-sm">Source</label>
                <select
                  value={(section as any).source || "folders"}
                  onChange={(e) => update("source", e.target.value)}
                  className="rounded border px-2 py-1"
                  style={{ backgroundColor: "white", color: "var(--color-brand-dark)", borderColor: "var(--color-brand-dark)" }}
                >
                  <option value="folders">Folders (Projects)</option>
                  <option value="tags">Tags (Services)</option>
                </select>
              </div>
              <div className="field-group">
                <div className="font-medium text-sm mb-1">Tag filter</div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`show-tags-${index}`}
                    checked={!!(section as any).showTagFilter}
                    onChange={(e) => update("showTagFilter", e.target.checked)}
                  />
                  <label htmlFor={`show-tags-${index}`} className="text-sm">Show tag filter pills</label>
                </div>
              </div>
              {((section as any).mode ?? "primary") === "primary" && (
                <>
                  <div className="space-y-1">
                    <label className="block text-sm">Route base</label>
                    <input
                      value={(section as any).routeBase || ""}
                      onChange={(e) => update("routeBase", e.target.value)}
                      className="w-full rounded border px-2 py-1"
                      placeholder="e.g. /projects"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm">Detail template slug</label>
                    <input
                      value={(section as any).detailTemplateSlug || ""}
                      onChange={(e) => update("detailTemplateSlug", e.target.value)}
                      className="w-full rounded border px-2 py-1"
                      placeholder="e.g. projects-detail"
                    />
                  </div>
                </>
              )}

              {displayItems.length > 0 && (() => {
                const currentSortMode: SortMode = (section as any).sortMode ?? "alphabetical";
                const sectionLabel = collectionSource === "folders" ? "Folder images" : "Tag images";
                return (
                  <div className="field-group space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="font-medium text-sm">{sectionLabel}</div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs" style={{ color: "var(--color-text-muted)" }}>Limit:</label>
                        <input
                          type="number"
                          min="0"
                          value={(section as any).maxItems ?? ""}
                          onChange={(e) => update("maxItems", e.target.value ? Number(e.target.value) : undefined)}
                          className="w-16 rounded border px-1 py-0.5 text-xs text-center"
                          style={{ backgroundColor: "white", color: "var(--color-brand-dark)", borderColor: "var(--color-brand-dark)" }}
                          placeholder="All"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>Sort by:</span>
                        {SORT_MODES.map((m) => (
                          <button
                            key={m.value}
                            type="button"
                            onClick={() => handleSortModeChange(m.value)}
                            className="px-2 py-0.5 text-xs rounded border transition-colors"
                            style={{
                              backgroundColor: currentSortMode === m.value ? "var(--color-brand-dark)" : "white",
                              color: currentSortMode === m.value ? "white" : "var(--color-brand-dark)",
                              borderColor: "var(--color-brand-dark)",
                            }}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      Drag cards to reorder · click an image to change it
                    </p>

                    <DndContext
                      sensors={entitySensors}
                      onDragStart={handleEntityDragStart}
                      onDragEnd={handleEntityDragEnd}
                    >
                      <SortableContext
                        items={displayItems.map((i) => i.slug)}
                        strategy={rectSortingStrategy}
                      >
                        <div className="grid grid-cols-3 gap-3">
                          {(displayItems as EntityItem[]).slice(0, (section as any).maxItems || displayItems.length).map((item) => (
                            <SortableEntityCard
                              key={item.slug}
                              item={item}
                              imageUrl={(section as any).entityImages?.[item.slug]}
                              defaultImage={collectionDefaultImages[item.slug]}
                              onChangeImage={(url) => {
                                const entityImages = {
                                  ...((section as any).entityImages || {}),
                                  [item.slug]: url || undefined,
                                };
                                if (!url) delete entityImages[item.slug];
                                update("entityImages", entityImages);
                              }}
                              collectionSource={collectionSource}
                            />
                          ))}
                        </div>
                      </SortableContext>
                      <DragOverlay>
                        {activeEntitySlug ? (
                          <EntityCardOverlay
                            imageUrl={(section as any).entityImages?.[activeEntitySlug]}
                            defaultImage={collectionDefaultImages[activeEntitySlug]}
                            name={displayItems.find((i) => i.slug === activeEntitySlug)?.name ?? ""}
                          />
                        ) : null}
                      </DragOverlay>
                    </DndContext>
                  </div>
                );
              })()}
            </div>
          )}

          {type === "collection-item" && (
            <div className="space-y-4">
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                Heading, tags, and description are populated automatically from the collection item. Only display settings can be configured here.
              </p>
              <div className="space-y-1">
                <label className="block text-sm">Source</label>
                <select
                  value={(section as any).source || "folders"}
                  onChange={(e) => update("source", e.target.value)}
                  className="rounded border px-2 py-1"
                  style={{ backgroundColor: "white", color: "var(--color-brand-dark)", borderColor: "var(--color-brand-dark)" }}
                >
                  <option value="folders">Folders (Projects)</option>
                  <option value="tags">Tags (Services)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-sm">Layout</label>
                <select
                  value={(section as any).layout || "grid"}
                  onChange={(e) => update("layout", e.target.value)}
                  className="rounded border px-2 py-1"
                  style={{ backgroundColor: "white", color: "var(--color-brand-dark)", borderColor: "var(--color-brand-dark)" }}
                >
                  <option value="grid">Grid</option>
                  <option value="bento">Bento</option>
                  <option value="masonry">Masonry</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`lightbox-${index}`}
                  checked={!!(section as any).lightbox}
                  onChange={(e) => update("lightbox", e.target.checked)}
                />
                <label htmlFor={`lightbox-${index}`} className="text-sm">Enable lightbox</label>
              </div>
            </div>
          )}

          </div>

          <SectionPreview section={section} index={index} />
        </div>
      )}
    </div>
  );
}
