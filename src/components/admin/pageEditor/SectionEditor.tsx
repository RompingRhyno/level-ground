"use client";
import { useState, useEffect } from "react";
import type { PageSection } from "@/types/sections";
import AlertDialog from "@/components/ui/AlertDialog";
import { useConfirm } from "../useConfirm";
import GalleryEditor from "./GalleryEditor";
import ContactEditor from "./ContactEditor";
import SectionPreview from "./SectionPreview";
import ImagePicker from "../ImagePicker";
import VideoPicker from "../VideoPicker";
import RichContentEditable from "./RichContentEditable";

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
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  section: PageSection;
  index: number;
  onChange: (s: PageSection, i: number) => void;
  onRemove: (i: number) => void;
  onMoveUp: (i: number) => void;
  onMoveDown: (i: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { confirm, dialogProps } = useConfirm();
  const type = section.type;

  const [collectionFolders, setCollectionFolders] = useState<{ slug: string; name: string }[]>([]);
  const [collectionTags, setCollectionTags] = useState<{ slug: string; name: string }[]>([]);
  const [collectionDefaultImages, setCollectionDefaultImages] = useState<Record<string, string>>({});

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
                <label className="block text-sm">Button href</label>
                <input value={(section as any).buttonHref || ""} onChange={(e) => update("buttonHref", e.target.value)} className="w-full rounded border px-2 py-1" />
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
                      <input value={s.href} onChange={(e) => {
                        const services = [...(section as any).services];
                        services[si] = { ...services[si], href: e.target.value };
                        update("services", services);
                      }} className="rounded border px-2 py-1 flex-1" placeholder="href" />
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

              {(() => {
                const items = collectionSource === "folders" ? collectionFolders : collectionTags;
                if (!items.length) return null;
                const label = collectionSource === "folders" ? "Folder images" : "Tag images";
                const autoHint = collectionSource === "folders"
                  ? "(auto: first image in folder)"
                  : "(auto: first image with tag)";
                return (
                  <div className="field-group">
                    <div className="font-medium text-sm mb-1">{label}</div>
                    {items.map((item) => (
                      <div key={item.slug} className="mt-3 rounded border p-2 space-y-2" style={{ backgroundColor: "var(--color-editor-bg)" }}>
                        <div className="text-sm font-medium mb-1">{item.name}</div>
                        <ImagePicker
                          value={(section as any).entityImages?.[item.slug] || ""}
                          onChange={(url) => {
                            const entityImages = { ...((section as any).entityImages || {}), [item.slug]: url || undefined };
                            if (!url) delete entityImages[item.slug];
                            update("entityImages", entityImages);
                          }}
                          defaultFolder={collectionSource === "folders" ? item.slug : undefined}
                          defaultTag={collectionSource === "tags" ? item.slug : undefined}
                          defaultImage={collectionDefaultImages[item.slug]}
                        />
                        {!(section as any).entityImages?.[item.slug] && (
                          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>{autoHint}</span>
                        )}
                      </div>
                    ))}
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
