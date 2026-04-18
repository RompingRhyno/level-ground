"use client";
import { useState } from "react";
import type { PageConfig, PageSection } from "@/types/sections";

function SectionEditor({ section, index, onChange, onRemove, onMoveUp, onMoveDown }: {
  section: PageSection;
  index: number;
  onChange: (s: PageSection, i: number) => void;
  onRemove: (i: number) => void;
  onMoveUp: (i: number) => void;
  onMoveDown: (i: number) => void;
}) {
  const type = section.type;

  function update<K extends string | number | boolean>(key: string, value: any) {
    onChange({ ...section, [key]: value } as PageSection, index);
  }

  return (
    <div className="border rounded p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="font-medium">{type} section</div>
          <div className="flex items-center gap-2">
          <button onClick={() => onMoveUp(index)} className="text-sm">↑</button>
          <button onClick={() => onMoveDown(index)} className="text-sm">↓</button>
          <button onClick={() => onRemove(index)} className="text-sm btn-negative px-2 py-1 rounded">Remove</button>
        </div>
      </div>

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

      {type === "services" && (
        <div className="space-y-2">
          <label className="block text-sm">Heading</label>
          <input value={(section as any).heading || ""} onChange={(e) => update("heading", e.target.value)} className="w-full rounded border px-2 py-1" />
          <label className="block text-sm">Body text</label>
          <textarea value={(section as any).bodyText || ""} onChange={(e) => update("bodyText", e.target.value)} className="w-full rounded border px-2 py-1" />

          <div>
            <div className="font-medium">Services</div>
            {((section as any).services || []).map((s: any, si: number) => (
              <div key={si} className="flex gap-2 items-center mt-2">
                <input value={s.title} onChange={(e) => {
                  const services = [...(section as any).services];
                  services[si] = { ...services[si], title: e.target.value };
                  update("services", services);
                }} className="rounded border px-2 py-1" />
                <input value={s.href} onChange={(e) => {
                  const services = [...(section as any).services];
                  services[si] = { ...services[si], href: e.target.value };
                  update("services", services);
                }} className="rounded border px-2 py-1" />
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
    </div>
  );
}

export default function AdminPageEditor({ initialPage }: { initialPage: PageConfig }) {
  const [label, setLabel] = useState(initialPage.label || "");
  const [sections, setSections] = useState<PageSection[]>(initialPage.sections || []);
  const [showRaw, setShowRaw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
    const tmp = arr[i - 1];
    arr[i - 1] = arr[i];
    arr[i] = tmp;
    setSections(arr);
  }

  function moveDown(i: number) {
    if (i === sections.length - 1) return;
    const arr = [...sections];
    const tmp = arr[i + 1];
    arr[i + 1] = arr[i];
    arr[i] = tmp;
    setSections(arr);
  }

  function addSection(type: string) {
    const defaults: any = {
      hero: { type: "hero", heading: "", subheading: "", buttonText: "", buttonHref: "", image: "" },
      twoColumn: { type: "twoColumn", title: "", body: "", image: "" },
      banner: { type: "banner", heading: "", subheading: "", image: "", overlayOpacity: 0.35 },
      services: { type: "services", heading: "", services: [], bodyText: "" },
    };
    setSections([...sections, defaults[type]]);
  }

  async function save() {
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
            <select onChange={(e) => addSection(e.target.value)} className="rounded border px-2 py-1">
              <option value="">Add...</option>
              <option value="hero">Hero</option>
              <option value="twoColumn">Two Column</option>
              <option value="banner">Banner</option>
              <option value="services">Services</option>
            </select>
            <button onClick={() => setShowRaw((s) => !s)} className="text-sm">{showRaw ? "Hide JSON" : "Show JSON"}</button>
          </div>
        </div>

        {!showRaw && (
          <div className="space-y-3 mt-3">
            {sections.map((s, i) => (
              <SectionEditor key={i} section={s} index={i} onChange={updateSection} onRemove={removeSection} onMoveUp={moveUp} onMoveDown={moveDown} />
            ))}
          </div>
        )}

        {showRaw && (
          <textarea className="mt-2 block w-full rounded border px-3 py-2 font-mono text-sm" rows={12} value={JSON.stringify(sections, null, 2)} onChange={(e) => {
            try {
              setSections(JSON.parse(e.target.value));
            } catch (_) {}
          }} />
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center rounded bg-blue-600 px-4 py-2 text-white"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        {message && <div className="text-sm text-gray-600">{message}</div>}
      </div>
    </section>
  );
}
