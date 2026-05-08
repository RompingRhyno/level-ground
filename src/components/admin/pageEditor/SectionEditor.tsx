"use client";
import { useState } from "react";
import type { PageSection } from "@/types/sections";
import AlertDialog from "@/components/ui/AlertDialog";
import { useConfirm } from "../useConfirm";
import GalleryEditor from "./GalleryEditor";
import SectionPreview from "./SectionPreview";
import ImagePicker from "../ImagePicker";

const SECTION_LABELS: Record<string, string> = {
  hero: "Hero",
  twoColumn: "Two Column",
  banner: "Banner",
  services: "Services",
  gallery: "Gallery",
  cta: "CTA",
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

  function update(key: string, value: any) {
    onChange({ ...section, [key]: value } as PageSection, index);
  }

  return (
    <div className="border rounded overflow-hidden" style={{ backgroundColor: "var(--color-bg-secondary)" }}>
      <AlertDialog {...dialogProps} />

      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200" style={{ backgroundColor: "var(--color-bg-primary)" }}>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-2 text-sm font-medium flex-1 text-left"
        >
          <span className="text-gray-400 text-xs">{expanded ? "▼" : "▶"}</span>
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
        <div className="p-3 space-y-2 section-fields">
          {type === "hero" && (
            <div className="space-y-2">
              <label className="block text-sm">Heading</label>
              <input value={(section as any).heading || ""} onChange={(e) => update("heading", e.target.value)} className="w-full rounded border px-2 py-1" />
              <label className="block text-sm">Subheading</label>
              <input value={(section as any).subheading || ""} onChange={(e) => update("subheading", e.target.value)} className="w-full rounded border px-2 py-1" />
              <label className="block text-sm">Button text</label>
              <input value={(section as any).buttonText || ""} onChange={(e) => update("buttonText", e.target.value)} className="w-full rounded border px-2 py-1" />
              <label className="block text-sm">Button href</label>
              <input value={(section as any).buttonHref || ""} onChange={(e) => update("buttonHref", e.target.value)} className="w-full rounded border px-2 py-1" />
              <label className="block text-sm">Image</label>
              <ImagePicker value={(section as any).image || ""} onChange={(url) => update("image", url)} />
            </div>
          )}

          {type === "twoColumn" && (
            <div className="space-y-2">
              <label className="block text-sm">Title</label>
              <input value={(section as any).title || ""} onChange={(e) => update("title", e.target.value)} className="w-full rounded border px-2 py-1" />
              <label className="block text-sm">Body</label>
              <textarea value={(section as any).body || ""} onChange={(e) => update("body", e.target.value)} className="w-full rounded border px-2 py-1" />
              <label className="block text-sm">Image</label>
              <ImagePicker value={(section as any).image || ""} onChange={(url) => update("image", url)} />
            </div>
          )}

          {type === "banner" && (
            <div className="space-y-2">
              <label className="block text-sm">Heading</label>
              <input value={(section as any).heading || ""} onChange={(e) => update("heading", e.target.value)} className="w-full rounded border px-2 py-1" />
              <label className="block text-sm">Subheading</label>
              <input value={(section as any).subheading || ""} onChange={(e) => update("subheading", e.target.value)} className="w-full rounded border px-2 py-1" />
              <label className="block text-sm">Image</label>
              <ImagePicker value={(section as any).image || ""} onChange={(url) => update("image", url)} />
              <label className="block text-sm">Overlay opacity (0-1)</label>
              <input value={(section as any).overlayOpacity ?? ""} onChange={(e) => update("overlayOpacity", Number(e.target.value))} className="w-full rounded border px-2 py-1" />
            </div>
          )}

          {type === "gallery" && (
            <GalleryEditor section={section} index={index} onChange={onChange} />
          )}

          {type === "services" && (
            <div className="space-y-2">
              <label className="block text-sm">Heading</label>
              <input value={(section as any).heading || ""} onChange={(e) => update("heading", e.target.value)} className="w-full rounded border px-2 py-1" />
              <label className="block text-sm">Body text</label>
              <textarea value={(section as any).bodyText || ""} onChange={(e) => update("bodyText", e.target.value)} className="w-full rounded border px-2 py-1" />
              <div>
                <div className="font-medium text-sm mb-1">Services</div>
                {((section as any).services || []).map((s: any, si: number) => (
                  <div key={si} className="mt-3 rounded border p-2 space-y-1.5">
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
                <button onClick={() => {
                  const services = [...((section as any).services || []), { title: "", image: "", href: "" }];
                  update("services", services);
                }} className="mt-2 text-sm">Add service</button>
              </div>
            </div>
          )}

          <SectionPreview section={section} index={index} />
        </div>
      )}
    </div>
  );
}
