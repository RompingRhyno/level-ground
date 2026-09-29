"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PageConfig, PageSection } from "@/types/sections";
import AlertDialog from "@/components/ui/AlertDialog";
import { PreviewWidthContext } from "./PreviewWidthContext";
import SectionEditor from "./SectionEditor";

// ── Preview size presets ───────────────────────────────────────────────────
const PREVIEW_SIZES = [
  { label: "Mobile",  width: 402  },
  { label: "Tablet",  width: 820  },
  { label: "FHD",     width: 1920 },
  { label: "QHD",     width: 2560 },
] as const;

type PreviewSizeLabel = typeof PREVIEW_SIZES[number]["label"];

/** Where the user was heading when the unsaved-changes dialog interrupted them. */
type PendingNav = { kind: "href"; href: string } | { kind: "back" };

const GUARD_STATE_KEY = "levelGroundEditorGuard";

// ── AdminPageEditor ────────────────────────────────────────────────────────
export default function AdminPageEditor({ initialPage }: { initialPage: PageConfig }) {
  const router = useRouter();
  const [label, setLabel] = useState(initialPage.label || "");
  const [savedLabel, setSavedLabel] = useState(initialPage.label || "");
  const [sections, setSections] = useState<PageSection[]>(initialPage.sections || []);
  const [savedSections, setSavedSections] = useState<PageSection[]>(initialPage.sections || []);
  const [previewSizeLabel, setPreviewSizeLabel] = useState<PreviewSizeLabel>("FHD");
  const previewWidth = PREVIEW_SIZES.find((s) => s.label === previewSizeLabel)!.width;
  const [showRaw, setShowRaw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  /** Non-null while the unsaved-changes dialog is open; remembers the interrupted destination. */
  const [pending, setPending] = useState<PendingNav | null>(null);
  /** Set just before we navigate away on purpose, so the popstate we cause is not treated as a fresh Back. */
  const leavingRef = useRef(false);

  const dirty =
    !saving &&
    (label !== savedLabel || JSON.stringify(sections) !== JSON.stringify(savedSections));

  const saveClass = dirty
    ? "btn-positive px-4 py-2 rounded text-sm"
    : "bg-gray-500 cursor-not-allowed text-white px-4 py-2 rounded text-sm";

  /**
   * Guard every way out while there are unsaved edits:
   *  - in-app links: caught in the capture phase, before Next's own Link handler;
   *  - Back button: while dirty we keep a duplicate history entry on the same URL, so pressing Back lands
   *    on it (URL unchanged, nothing lost) and hands us the decision. Staying re-arms the entry; leaving
   *    goes one entry further back, which is where the user was actually heading;
   *  - reload / tab close: the browser's own prompt, the only hook available for those.
   *
   * Two honest limits: a fresh tab has no entry behind the editor, so "leaving" there does nothing, and a
   * deliberate save leaves one harmless extra history entry behind (one dead Back press).
   */
  useEffect(() => {
    if (!dirty) return;

    window.history.pushState({ [GUARD_STATE_KEY]: true }, "", window.location.href);

    function onDocumentClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;

      event.preventDefault();
      event.stopPropagation();
      setPending({ kind: "href", href: `${url.pathname}${url.search}${url.hash}` });
    }

    function onPopState() {
      if (leavingRef.current) return;
      setPending({ kind: "back" });
    }

    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    document.addEventListener("click", onDocumentClick, true);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("click", onDocumentClick, true);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [dirty]);

  /** Staying put after a Back press: re-arm the duplicate entry so the next press is caught too. */
  function rearmBackGuard() {
    if (dirty) window.history.pushState({ [GUARD_STATE_KEY]: true }, "", window.location.href);
  }

  function goTo(target: PendingNav) {
    leavingRef.current = true;
    if (target.kind === "href") router.push(target.href);
    else window.history.back();
  }

  function updateSection(s: PageSection, i: number) {
    const arr = [...sections];
    // If this section is becoming primary, demote any other primary collection-index
    if (
      s.type === "collection-index" &&
      ((s as any).mode ?? "primary") === "primary"
    ) {
      for (let j = 0; j < arr.length; j++) {
        if (j !== i && arr[j].type === "collection-index") {
          const existing = arr[j] as any;
          if ((existing.mode ?? "primary") === "primary") {
            arr[j] = { ...existing, mode: "reference" };
          }
        }
      }
    }
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
      video: { type: "video", heading: "", subheading: "", videoUrl: "" },
      contact: { id: crypto.randomUUID(), type: "contact", heading: "", fields: [], recipientIds: [] },
      "collection-index": { type: "collection-index", mode: "primary", source: "folders", routeBase: "", detailTemplateSlug: "", heading: "" },
      "collection-item": { type: "collection-item", layout: "grid", lightbox: true },
    };
    if (defaults[type]) {
      // Auto-set mode: first collection-index gets primary, rest get reference
      if (type === "collection-index") {
        const hasPrimary = sections.some(
          (s) => s.type === "collection-index" && ((s as any).mode ?? "primary") === "primary"
        );
        if (hasPrimary) {
          defaults[type] = { ...defaults[type], mode: "reference" };
        }
      }
      setSections([...sections, defaults[type]]);
    }
  }

  /** Resolves true when the page was saved, so the leave-guard can navigate only on success. */
  async function save(): Promise<boolean> {
    if (!dirty) return true;
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
        return false;
      }
      setMessage("Saved");
      setSavedSections([...sections]);
      setSavedLabel(label);
      return true;
    } catch (err: any) {
      setMessage(err.message || String(err));
      return false;
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="max-w-500 mx-auto px-4 space-y-4">
      <AlertDialog
        open={pending !== null}
        title="Unsaved changes"
        cancelLabel="Discard changes"
        cancelVariant="danger"
        confirmLabel="Save"
        confirmVariant="positive"
        onDismiss={() => {
          setPending(null);
          rearmBackGuard();
        }}
        onCancel={() => {
          const target = pending;
          setPending(null);
          if (target) goTo(target);
        }}
        onConfirm={async () => {
          const target = pending;
          const saved = await save();
          if (saved) {
            setPending(null);
            if (target) goTo(target);
          }
        }}
      />

      <div>
        <label className="block text-sm font-medium text-(--color-text-dark)">Label</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="mt-1 block w-full max-w-90 rounded border px-3 py-2"
          style={{ backgroundColor: "white", color: "var(--color-brand-dark)", borderColor: "var(--color-brand-dark)" }}
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-(--color-text-dark)">Sections</label>
          <div className="flex items-center gap-2">
            <select
              defaultValue=""
              onChange={(e) => { addSection(e.target.value); (e.target as HTMLSelectElement).value = ""; }}
              className="rounded border px-2 py-1 text-sm"
              style={{ backgroundColor: "white", color: "var(--color-brand-dark)", borderColor: "var(--color-brand-dark)" }}
            >
              <option value="" disabled>Add section&hellip;</option>
              <option value="hero">Hero</option>
              <option value="twoColumn">Two Column</option>
              <option value="banner">Banner</option>
              <option value="services">Services</option>
              <option value="gallery">Gallery</option>
              <option value="video">Video</option>
              <option value="contact">Contact Form</option>
              <option value="collection-index">Collection Index</option>
              <option value="collection-item">Collection Item</option>
            </select>
            <button onClick={() => setShowRaw((s) => !s)} className="text-sm admin-btn px-2 py-1 rounded">
              {showRaw ? "Hide JSON" : "Show JSON"}
            </button>
            <button onClick={save} disabled={!dirty || saving} className={saveClass}>
              {saving ? "Saving\u2026" : "Save"}
            </button>
          </div>
        </div>

        {/* Preview size toggles */}
        <div className="flex items-center gap-2 mt-3 mb-1">
          <span className="text-xs text-(--color-text-dark)">Preview size:</span>
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
          <span className="text-xs text-(--color-text-light) ml-1">{previewWidth}px</span>
        </div>

        {!showRaw && (
          <PreviewWidthContext.Provider value={previewWidth}>
            <div className="space-y-3 mt-3">
              {sections.map((s, i) => (
                <SectionEditor
                  key={i}
                  section={s}
                  index={i}
                  allSections={sections}
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
            style={{ backgroundColor: "white", color: "var(--color-brand-dark)", borderColor: "var(--color-brand-dark)" }}
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
        {message && <div className="text-sm text-(--color-text-light)">{message}</div>}
        <button onClick={save} disabled={!dirty || saving} className={saveClass}>
          {saving ? "Saving\u2026" : "Save"}
        </button>
      </div>
    </section>
  );
}
