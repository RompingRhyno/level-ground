"use client";
import { useState } from "react";

export default function FileUploader({ folder = "" }: { folder?: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function startUpload() {
    if (!file) return setMessage("No file selected");
    setUploading(true);
    setMessage("Starting upload...");

    try {
      const res = await fetch(`/api/assets/presign`, { method: "POST", body: JSON.stringify({ filename: file.name, contentType: file.type, folder }) , headers: { 'Content-Type': 'application/json' }});
      if (!res.ok) throw new Error("Presign failed");
      const body = await res.json();
      const { uploadUrl, key, publicUrl } = body;

      // upload via signed url
      const put = await fetch(uploadUrl, { method: "PUT", body: file, headers: { 'Content-Type': file.type } });
      if (!put.ok) {
        const text = await put.text().catch(() => null);
        throw new Error("Upload failed: " + (text || put.status));
      }

      // register in DB
      const register = await fetch(`/api/assets`, { method: "POST", headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, filename: file.name, mime: file.type, size: file.size, folder, publicUrl }) });
      if (!register.ok) throw new Error("Register failed");

      setMessage("Uploaded");
      setFile(null);
    } catch (err: any) {
      setMessage(err.message || String(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <label className="inline-flex items-center gap-2 rounded bg-white border px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 16.5V19a2 2 0 002 2h14a2 2 0 002-2v-2.5M16 7l-4-4m0 0L8 7m4-4v11" />
          </svg>
          <span className="text-sm text-gray-700">Browse…</span>
          <input
            type="file"
            className="sr-only"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        <div className="flex-1">
          <div className="text-sm text-gray-700">{file ? file.name : <span className="text-gray-400">No file selected</span>}</div>
        </div>

        <button
          type="button"
          disabled={!file || uploading}
          onClick={startUpload}
          className={`rounded px-3 py-1 text-white ${!file || uploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600'}`}
        >
          {uploading ? "Uploading..." : "Upload"}
        </button>
      </div>

      {message && <div className="text-sm text-gray-600">{message}</div>}
    </div>
  );
}
