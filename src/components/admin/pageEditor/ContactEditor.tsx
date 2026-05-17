"use client";
import { useEffect, useState } from "react";
import type { PageSection, ContactSection, ContactFormField, ContactFormFieldType } from "@/types/sections";
import ImagePicker from "../ImagePicker";
import RichContentEditable from "./RichContentEditable";

type Recipient = { id: number; email: string; name: string | null };

const FIELD_TYPE_OPTIONS: ContactFormFieldType[] = ["text", "email", "tel", "textarea"];

export default function ContactEditor({
  section,
  index,
  onChange,
}: {
  section: PageSection;
  index: number;
  onChange: (s: PageSection, i: number) => void;
}) {
  if (section.type !== "contact" || !section.id) {
    throw new Error("ContactEditor requires a contact section with a valid id");
  }

  const cs = section as ContactSection;

  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [newRecipientEmail, setNewRecipientEmail] = useState("");
  const [newRecipientName, setNewRecipientName] = useState("");
  const [addingRecipient, setAddingRecipient] = useState(false);
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const [newServiceText, setNewServiceText] = useState("");

  useEffect(() => {
    fetch("/api/contact-recipients")
      .then((r) => r.json())
      .then((data: { recipients: Recipient[] }) => setRecipients(data.recipients))
      .catch(() => {});
  }, []);

  function update(patch: Partial<ContactSection>) {
    onChange({ ...cs, ...patch } as PageSection, index);
  }

  function updateField(fieldIndex: number, patch: Partial<ContactFormField>) {
    const fields = [...cs.fields];
    fields[fieldIndex] = { ...fields[fieldIndex], ...patch };
    update({ fields });
  }

  function addField() {
    const newField: ContactFormField = {
      id: crypto.randomUUID(),
      label: "",
      type: "text",
      required: false,
    };
    update({ fields: [...cs.fields, newField] });
  }

  function removeField(fieldIndex: number) {
    const fields = [...cs.fields];
    fields.splice(fieldIndex, 1);
    update({ fields });
  }

  function addServiceOption() {
    const trimmed = newServiceText.trim();
    if (!trimmed) return;
    update({ serviceOptions: [...(cs.serviceOptions ?? []), trimmed] });
    setNewServiceText("");
  }

  function removeServiceOption(i: number) {
    const opts = [...(cs.serviceOptions ?? [])];
    opts.splice(i, 1);
    update({ serviceOptions: opts });
  }

  function toggleRecipient(id: number) {
    const ids = cs.recipientIds ?? [];
    if (ids.includes(id)) {
      update({ recipientIds: ids.filter((rid) => rid !== id) });
    } else {
      update({ recipientIds: [...ids, id] });
    }
  }

  async function addRecipient() {
    const email = newRecipientEmail.trim();
    if (!email) return;
    setAddingRecipient(true);
    setRecipientError(null);
    try {
      const res = await fetch("/api/contact-recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: newRecipientName.trim() || undefined }),
      });
      let data: unknown;
      try { data = await res.json(); } catch { data = {}; }
      if (!res.ok) {
        setRecipientError((data as { error?: string }).error ?? "Failed to add recipient");
        return;
      }
      const created: Recipient = (data as { recipient: Recipient }).recipient;
      setRecipients((prev) => {
        const exists = prev.find((r) => r.id === created.id);
        return exists ? prev.map((r) => (r.id === created.id ? created : r)) : [...prev, created];
      });
      update({ recipientIds: [...(cs.recipientIds ?? []), created.id] });
      setNewRecipientEmail("");
      setNewRecipientName("");
    } finally {
      setAddingRecipient(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Section meta */}
      <div className="space-y-2">
        <label className="block text-sm">Heading</label>
        <RichContentEditable
          value={cs.heading}
          onChange={(val) => update({ heading: val })}
          className="w-full"
        />
        <label className="block text-sm">Subheading</label>
        <RichContentEditable
          value={cs.subheading ?? ""}
          onChange={(val) => update({ subheading: val })}
          className="w-full"
        />
        <label className="block text-sm">Submit button label</label>
        <input
          value={cs.submitLabel ?? ""}
          onChange={(e) => update({ submitLabel: e.target.value })}
          className="w-full rounded border px-2 py-1"
          placeholder="Send message"
        />
        <label className="block text-sm mt-2">Side image (optional)</label>
        <ImagePicker
          value={cs.image ?? ""}
          onChange={(url) => update({ image: url })}
        />
        {cs.image && (
          <button
            type="button"
            onClick={() => update({ image: undefined })}
            className="mt-1 text-xs text-red-600 underline"
          >
            Remove image
          </button>
        )}
      </div>

      {/* Fields */}
      <div>
        <div className="font-medium text-sm mb-1">Fields</div>
        {cs.fields.map((field, fi) => (
          <div key={field.id} className="mt-2 rounded border p-2 space-y-1.5">
            <div className="flex gap-2 items-center flex-wrap">
              <input
                value={field.label}
                onChange={(e) => updateField(fi, { label: e.target.value })}
                className="rounded border px-2 py-1 flex-1 min-w-[100px]"
                placeholder="Label"
              />
              <select
                value={field.type}
                onChange={(e) => updateField(fi, { type: e.target.value as ContactFormFieldType })}
                className="rounded border px-2 py-1"
              >
                {FIELD_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <label className="flex items-center gap-1 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(e) => updateField(fi, { required: e.target.checked })}
                />
                Required
              </label>
              <button
                type="button"
                onClick={() => removeField(fi)}
                className="text-sm btn-negative px-2 py-1 rounded"
              >
                Remove
              </button>
            </div>
            <input
              value={field.placeholder ?? ""}
              onChange={(e) => updateField(fi, { placeholder: e.target.value })}
              className="w-full rounded border px-2 py-1 text-sm"
              placeholder="Placeholder (optional)"
            />
          </div>
        ))}
        <button type="button" onClick={addField} className="mt-2 text-sm">
          + Add field
        </button>
      </div>

      {/* Services */}
      <div>
        <div className="font-medium text-sm mb-1">Services (optional)</div>
        <label className="block text-sm">Services section heading</label>
        <input
          value={cs.servicesHeading ?? ""}
          onChange={(e) => update({ servicesHeading: e.target.value })}
          className="w-full rounded border px-2 py-1 mb-2"
          placeholder="Services"
        />
        {(cs.serviceOptions ?? []).map((opt, oi) => (
          <div key={oi} className="flex items-center gap-2 mt-1">
            <span className="text-sm flex-1">{opt}</span>
            <button
              type="button"
              onClick={() => removeServiceOption(oi)}
              className="text-xs btn-negative px-2 py-0.5 rounded"
            >
              Remove
            </button>
          </div>
        ))}
        <div className="flex gap-2 mt-2">
          <input
            value={newServiceText}
            onChange={(e) => setNewServiceText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addServiceOption(); } }}
            className="rounded border px-2 py-1 flex-1 text-sm"
            placeholder="New service option"
          />
          <button type="button" onClick={addServiceOption} className="text-sm px-2 py-1 rounded border">
            Add
          </button>
        </div>
      </div>

      {/* Uploader */}
      <div>
        <label className="flex items-center gap-2 text-sm cursor-pointer font-medium">
          <input
            type="checkbox"
            checked={cs.showUploader ?? false}
            onChange={(e) => update({ showUploader: e.target.checked })}
          />
          Allow photo uploads
        </label>
        {cs.showUploader && (
          <>
            <label className="block text-sm mt-2">Upload prompt label</label>
            <input
              value={cs.uploaderLabel ?? ""}
              onChange={(e) => update({ uploaderLabel: e.target.value })}
              className="w-full rounded border px-2 py-1"
              placeholder="Attach photos"
            />
          </>
        )}
      </div>

      {/* Recipients */}
      <div>
        <div className="font-medium text-sm mb-1">Recipients</div>
        {recipients.length === 0 && (
          <p className="text-xs text-gray-500 mb-1">No recipients yet.</p>
        )}
        {recipients.map((r) => (
          <label key={r.id} className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={(cs.recipientIds ?? []).includes(r.id)}
              onChange={() => toggleRecipient(r.id)}
            />
            {r.name ? `${r.name} <${r.email}>` : r.email}
          </label>
        ))}
        <div className="mt-2 space-y-1">
          <div className="text-xs font-medium text-gray-600">Add recipient</div>
          <input
            value={newRecipientName}
            onChange={(e) => setNewRecipientName(e.target.value)}
            className="w-full rounded border px-2 py-1 text-sm"
            placeholder="Name (optional)"
          />
          <input
            value={newRecipientEmail}
            onChange={(e) => setNewRecipientEmail(e.target.value)}
            className="w-full rounded border px-2 py-1 text-sm"
            placeholder="Email"
            type="email"
          />
          {recipientError && <p className="text-xs text-red-600">{recipientError}</p>}
          <button
            type="button"
            onClick={addRecipient}
            disabled={addingRecipient}
            className="text-sm px-3 py-1 rounded border disabled:opacity-50"
          >
            {addingRecipient ? "Adding…" : "Add recipient"}
          </button>
        </div>
      </div>
    </div>
  );
}
