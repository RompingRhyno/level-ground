"use client";
import { useState } from "react";
import type { PageConfig } from "@/types/sections";

export default function AdminPageEditor({ initialPage }: { initialPage: PageConfig }) {
  const [label, setLabel] = useState(initialPage.label || "");
  const [sectionsJson, setSectionsJson] = useState(() => JSON.stringify(initialPage.sections, null, 2));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMessage(null);

    let sections;
    try {
      sections = JSON.parse(sectionsJson);
    } catch (err: any) {
      setMessage("Invalid JSON for sections");
      setSaving(false);
      return;
    }

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
        <label className="block text-sm font-medium text-gray-700">Sections (JSON)</label>
        <textarea
          value={sectionsJson}
          onChange={(e) => setSectionsJson(e.target.value)}
          rows={12}
          className="mt-1 block w-full rounded border px-3 py-2 font-mono text-sm"
        />
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
