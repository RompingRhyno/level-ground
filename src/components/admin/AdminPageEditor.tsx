"use client";
import { useState, useRef, useEffect, useCallback, createContext, useContext } from "react";
import type {
  PageConfig,
  PageSection,
  GallerySection,
} from "@/types/sections";
import GalleryPicker from "./GalleryPicker";
import AlertDialog from "@/components/ui/AlertDialog";

// ── Preview size presets ───────────────────────────────────────────────────
const PREVIEW_SIZES = [
  { label: "Mobile",  width: 402  },
  { label: "Tablet",  width: 820  },
  { label: "FHD",     width: 1920 },
  { label: "QHD",     width: 2560 },
] as const;

type PreviewSizeLabel = typeof PREVIEW_SIZES[number]["label"];

const PreviewWidthContext = createContext<number>(1920);

// ── GalleryEditor ──────────────────────────────────────────────────────────
function GalleryEditor({
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
          {gs.mode === "static" ? "Choose images…" : "Edit filters…"}
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

// ── SectionPreview ─────────────────────────────────────────────────────────
function SectionPreview({ section, index }: { section: PageSection; index: number }) {
  const type = section.type;
  // Banner is full-bleed — it manages its own bg
  const bg = type === "banner"
    ? undefined
    : index % 2 === 0
      ? "var(--color-bg-primary)"
      : "var(--color-bg-secondary)";

  if (type === "gallery") {
    const gs = section as GallerySection;
    const assetCount = gs.mode === "static" ? (gs as any).assetIds?.length ?? 0 : null;
    const tagCount = gs.mode === "dynamic" ? ((gs as any).filters?.tags?.length ?? 0) : null;
    const folder = gs.mode === "dynamic" ? ((gs as any).filters?.folder ?? null) : null;
    return (
      <div className="mt-3">
        <div className="text-xs text-gray-500 mb-1">Preview</div>
        <div
          className="rounded border border-gray-300 flex items-center justify-center"
          style={{ height: 100, backgroundColor: bg }}
        >
          <div className="text-center text-sm text-gray-500">
            <div className="font-medium text-gray-600 capitalize">{gs.layout ?? "grid"} gallery · {gs.mode}</div>
            <div className="text-xs mt-1">
              {gs.mode === "static"
                ? `${assetCount} image${assetCount !== 1 ? "s" : ""}`
                : `${tagCount ? `${tagCount} tag${tagCount !== 1 ? "s" : ""}` : "Any tag"}${folder ? ` · folder: ${folder}` : ""}`}
              {gs.lightbox ? " · lightbox" : ""}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <SectionPreviewFrame section={section} bg={bg} />;
}

// ── SectionPreviewFrame (iframe-based) ────────────────────────────────────
// Renders section content inside an <iframe> whose CSS width equals the chosen
// preview viewport width. Because iframes have their own viewport, CSS media
// queries inside them fire based on the iframe's CSS width — not the browser
// window width — giving an accurate mobile/tablet/desktop layout preview.
function SectionPreviewFrame({ section, bg }: { section: PageSection; bg?: string }) {
  const previewWidth = useContext(PreviewWidthContext);
  const measureRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // scale = how much to shrink the iframe to fit the editor panel
  const [scale, setScale] = useState(1);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  // rawHeight = the iframe's intrinsic scrollHeight (un-scaled)
  const [rawHeight, setRawHeight] = useState(300);
  const [iframeReady, setIframeReady] = useState(false);

  // Keep a ref to scale so the message handler always sees the latest value
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  // Measure available editor width and compute scale
  const measureScale = useCallback(() => {
    if (!measureRef.current) return;
    const available = measureRef.current.offsetWidth;
    if (!available) return;
    const containerW = Math.min(available, previewWidth);
    setScale(containerW / previewWidth);
    setContainerWidth(containerW);
  }, [previewWidth]);

  useEffect(() => {
    measureScale();
    const ro = new ResizeObserver(measureScale);
    if (measureRef.current) ro.observe(measureRef.current);
    return () => ro.disconnect();
  }, [measureScale]);

  // Send section data whenever the iframe signals ready or data changes
  useEffect(() => {
    if (!iframeReady || !iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      { type: "preview-data", section, bg },
      window.location.origin,
    );
  }, [iframeReady, section, bg]);

  // Handle messages from the iframe (preview-ready + preview-height)
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.data?.type === "preview-ready") {
        setIframeReady(true);
      } else if (event.data?.type === "preview-height") {
        setRawHeight(event.data.height as number);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []); // no deps — uses iframeRef + scaleRef (always current)

  const containerHeight = rawHeight * scale;

  return (
    <div className="mt-3">
      {/* Invisible full-width sentinel — measures available editor space */}
      <div ref={measureRef} className="w-full" style={{ height: 0, overflow: "hidden" }} />
      <div className="text-xs text-gray-500 mb-1">Preview</div>
      <div
        style={{
          width: containerWidth ?? "100%",
          height: containerHeight,
          overflow: "hidden",
          position: "relative",
          transition: "height 150ms ease",
          border: "2px solid var(--color-brand-dark)",
          borderRadius: "0.25rem",
        }}
      >
        <iframe
          ref={iframeRef}
          src="/preview"
          title="Section preview"
          style={{
            width: previewWidth,
            height: rawHeight,
            border: "none",
            display: "block",
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            pointerEvents: "none",
            // Fade in once the iframe has reported its content height
            opacity: iframeReady ? 1 : 0,
            transition: "opacity 0.15s ease",
          }}
        />
      </div>
    </div>
  );
}

// ── SectionEditor ──────────────────────────────────────────────────────────
const SECTION_LABELS: Record<string, string> = {
  hero: "Hero",
  twoColumn: "Two Column",
  banner: "Banner",
  services: "Services",
  gallery: "Gallery",
  cta: "CTA",
};

function SectionEditor({
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
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const type = section.type;

  function update(key: string, value: any) {
    onChange({ ...section, [key]: value } as PageSection, index);
  }

  return (
    <div className="border rounded overflow-hidden" style={{ backgroundColor: "var(--color-bg-secondary)" }}>
      <AlertDialog
        open={confirmRemoveOpen}
        title={`Remove ${SECTION_LABELS[type] ?? type} section?`}
        description="This section will be permanently removed from the page."
        confirmVariant="danger"
        confirmLabel="Delete"
        onConfirm={() => { setConfirmRemoveOpen(false); onRemove(index); }}
        onCancel={() => setConfirmRemoveOpen(false)}
      />

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
          <button type="button" onClick={() => setConfirmRemoveOpen(true)} className="px-2 py-1 text-sm rounded btn-negative">Remove</button>
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
              <input value={(section as any).image || ""} onChange={(e) => update("image", e.target.value)} className="w-full rounded border px-2 py-1" />
            </div>
          )}

          {type === "twoColumn" && (
            <div className="space-y-2">
              <label className="block text-sm">Title</label>
              <input value={(section as any).title || ""} onChange={(e) => update("title", e.target.value)} className="w-full rounded border px-2 py-1" />
              <label className="block text-sm">Body</label>
              <textarea value={(section as any).body || ""} onChange={(e) => update("body", e.target.value)} className="w-full rounded border px-2 py-1" />
              <label className="block text-sm">Image</label>
              <input value={(section as any).image || ""} onChange={(e) => update("image", e.target.value)} className="w-full rounded border px-2 py-1" />
            </div>
          )}

          {type === "banner" && (
            <div className="space-y-2">
              <label className="block text-sm">Heading</label>
              <input value={(section as any).heading || ""} onChange={(e) => update("heading", e.target.value)} className="w-full rounded border px-2 py-1" />
              <label className="block text-sm">Subheading</label>
              <input value={(section as any).subheading || ""} onChange={(e) => update("subheading", e.target.value)} className="w-full rounded border px-2 py-1" />
              <label className="block text-sm">Image</label>
              <input value={(section as any).image || ""} onChange={(e) => update("image", e.target.value)} className="w-full rounded border px-2 py-1" />
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
                  <div key={si} className="flex gap-2 items-center mt-2">
                    <input value={s.title} onChange={(e) => {
                      const services = [...(section as any).services];
                      services[si] = { ...services[si], title: e.target.value };
                      update("services", services);
                    }} className="rounded border px-2 py-1" placeholder="Title" />
                    <input value={s.href} onChange={(e) => {
                      const services = [...(section as any).services];
                      services[si] = { ...services[si], href: e.target.value };
                      update("services", services);
                    }} className="rounded border px-2 py-1" placeholder="href" />
                    <button onClick={() => {
                      const services = [...(section as any).services];
                      services.splice(si, 1);
                      update("services", services);
                    }} className="text-sm btn-negative px-2 py-1 rounded">Remove</button>
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

// ── AdminPageEditor ────────────────────────────────────────────────────────
export default function AdminPageEditor({ initialPage }: { initialPage: PageConfig }) {
  const [label, setLabel] = useState(initialPage.label || "");
  const [savedLabel, setSavedLabel] = useState(initialPage.label || "");
  const [sections, setSections] = useState<PageSection[]>(initialPage.sections || []);
  const [savedSections, setSavedSections] = useState<PageSection[]>(initialPage.sections || []);
  const [previewSizeLabel, setPreviewSizeLabel] = useState<PreviewSizeLabel>("FHD");
  const previewWidth = PREVIEW_SIZES.find((s) => s.label === previewSizeLabel)!.width;
  const [showRaw, setShowRaw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const dirty =
    !saving &&
    (label !== savedLabel || JSON.stringify(sections) !== JSON.stringify(savedSections));

  const saveClass = dirty
    ? "btn-positive px-4 py-2 rounded text-sm"
    : "bg-gray-500 cursor-not-allowed text-white px-4 py-2 rounded text-sm";

  function updateSection(s: PageSection, i: number) {
    const arr = [...sections];
    arr[i] = s;
    setSections(arr);
  }

  function removeSection(i: number) {
    const arr = [...sections];
    arr.splice(i, 1);
    setSections(arr);
  }

  function moveUp(i: number) {
    if (i === 0) return;
    const arr = [...sections];
    [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
    setSections(arr);
  }

  function moveDown(i: number) {
    if (i === sections.length - 1) return;
    const arr = [...sections];
    [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
    setSections(arr);
  }

  function addSection(type: string) {
    if (!type) return;
    const defaults: any = {
      hero: { type: "hero", heading: "", subheading: "", buttonText: "", buttonHref: "", image: "" },
      twoColumn: { type: "twoColumn", title: "", body: "", image: "" },
      banner: { type: "banner", heading: "", subheading: "", image: "", overlayOpacity: 0.35 },
      services: { type: "services", heading: "", services: [], bodyText: "" },
      gallery: { type: "gallery", mode: "static", layout: "grid", lightbox: false, assetIds: [] },
    };
    if (defaults[type]) setSections([...sections, defaults[type]]);
  }

  async function save() {
    if (!dirty) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/pages/${initialPage.slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: initialPage.slug, label, sections }),
      });

      if (!res.ok) {
        const body = await res.json();
        setMessage(body?.error || `Save failed (${res.status})`);
      } else {
        setMessage("Saved");
        setSavedSections([...sections]);
        setSavedLabel(label);
      }
    } catch (err: any) {
      setMessage(err.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Label</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="mt-1 block w-full rounded border px-3 py-2"
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700">Sections</label>
          <div className="flex items-center gap-2">
            <select
              defaultValue=""
              onChange={(e) => { addSection(e.target.value); (e.target as HTMLSelectElement).value = ""; }}
              className="rounded border px-2 py-1 text-sm"
            >
              <option value="" disabled>Add section…</option>
              <option value="hero">Hero</option>
              <option value="twoColumn">Two Column</option>
              <option value="banner">Banner</option>
              <option value="services">Services</option>
              <option value="gallery">Gallery</option>
            </select>
            <button onClick={() => setShowRaw((s) => !s)} className="text-sm admin-btn px-2 py-1 rounded">
              {showRaw ? "Hide JSON" : "Show JSON"}
            </button>
            <button onClick={save} disabled={!dirty || saving} className={saveClass}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        {/* Preview size toggles */}
        <div className="flex items-center gap-2 mt-3 mb-1">
          <span className="text-xs text-gray-500">Preview size:</span>
          {PREVIEW_SIZES.map((ps) => (
            <button
              key={ps.label}
              type="button"
              onClick={() => setPreviewSizeLabel(ps.label)}
              className="px-2 py-0.5 text-xs rounded border transition-colors"
              style={{
                backgroundColor: previewSizeLabel === ps.label ? "var(--color-brand-dark)" : "white",
                color: previewSizeLabel === ps.label ? "white" : "var(--color-brand-dark)",
                borderColor: "var(--color-brand-dark)",
              }}
            >
              {ps.label}
            </button>
          ))}
          <span className="text-xs text-gray-400 ml-1">{previewWidth}px</span>
        </div>

        {!showRaw && (
          <PreviewWidthContext.Provider value={previewWidth}>
          <div className="space-y-3 mt-3">
            {sections.map((s, i) => (
              <SectionEditor
                key={i}
                section={s}
                index={i}
                onChange={updateSection}
                onRemove={removeSection}
                onMoveUp={moveUp}
                onMoveDown={moveDown}
              />
            ))}
          </div>
          </PreviewWidthContext.Provider>
        )}

        {showRaw && (
          <textarea
            className="mt-2 block w-full rounded border px-3 py-2 font-mono text-sm"
            rows={12}
            value={JSON.stringify(sections, null, 2)}
            onChange={(e) => {
              try { setSections(JSON.parse(e.target.value)); } catch (_) {}
            }}
          />
        )}
      </div>

      {/* Bottom save row */}
      <div className="flex items-center justify-end gap-3">
        {message && <div className="text-sm text-gray-600">{message}</div>}
        <button onClick={save} disabled={!dirty || saving} className={saveClass}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </section>
  );
}
