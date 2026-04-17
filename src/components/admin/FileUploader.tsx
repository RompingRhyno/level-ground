"use client";
import React, { useEffect, useState } from "react";

type UploadItem = {
  id: string;
  file: File;
  preview?: string;
  progress: number;
  status: "idle" | "uploading" | "done" | "error";
  error?: string;
  key?: string;
  publicUrl?: string;
};

export default function FileUploader({ folder = "" }: { folder?: string }) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [running, setRunning] = useState(false);
  const [concurrency] = useState(4);

  useEffect(() => {
    return () => {
      // revoke previews
      items.forEach((it) => it.preview && URL.revokeObjectURL(it.preview));
    };
  }, [items]);

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const next: UploadItem[] = Array.from(files).map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      file: f,
      preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
      progress: 0,
      status: "idle",
    }));
    setItems((s) => [...next, ...s]);
  }

  function updateItem(id: string, patch: Partial<UploadItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function uploadWithProgress(uploadUrl: string, file: File, contentType: string, onProgress: (p: number) => void) {
    return new Promise<Response>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl, true);
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) onProgress(Math.round((ev.loaded / ev.total) * 100));
      };
      xhr.onload = () => {
        const ok = xhr.status >= 200 && xhr.status < 300;
        if (ok) {
          // create a Response-like object
          resolve(new Response(xhr.responseText, { status: xhr.status }));
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.send(file);
    });
  }

  function uploadFormWithProgress(actionUrl: string, fields: Record<string, string>, file: File, onProgress: (p: number) => void) {
    return new Promise<Response>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", actionUrl, true);
      const form = new FormData();
      Object.entries(fields || {}).forEach(([k, v]) => form.append(k, v));
      form.append("file", file);
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) onProgress(Math.round((ev.loaded / ev.total) * 100));
      };
      xhr.onload = () => {
        const ok = xhr.status >= 200 && xhr.status < 300;
        if (ok) resolve(new Response(xhr.responseText, { status: xhr.status }));
        else reject(new Error(`Upload failed: ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.send(form);
    });
  }

  async function uploadItem(item: UploadItem) {
    updateItem(item.id, { status: "uploading", progress: 1 });
    try {
      const presignRes = await fetch(`/api/assets/presign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: item.file.name, contentType: item.file.type, folder }),
      });
      if (!presignRes.ok) throw new Error("Presign failed");
      const { uploadUrl, key, publicUrl } = await presignRes.json();

      await uploadWithProgress(uploadUrl, item.file, item.file.type, (p) => updateItem(item.id, { progress: p }));

      const registerRes = await fetch(`/api/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, filename: item.file.name, mime: item.file.type, size: item.file.size, folder, publicUrl }),
      });
      if (!registerRes.ok) throw new Error("Register failed");
      const registered = await registerRes.json();

      updateItem(item.id, { status: "done", progress: 100, key, publicUrl: registered.publicUrl || publicUrl });
    } catch (err: any) {
      updateItem(item.id, { status: "error", error: err.message || String(err) });
    }
  }

  async function startAll() {
    if (!items.length) return;
    setRunning(true);

    // prepare queue and request batch presign for all idle items
    const queue = items.filter((it) => it.status === "idle");
    if (queue.length === 0) {
      setRunning(false);
      return;
    }

    try {
      const filesPayload = queue.map((it) => ({ filename: it.file.name }));
      const presignRes = await fetch(`/api/assets/presign/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: filesPayload, folder }),
      });
      if (!presignRes.ok) throw new Error("Batch presign failed");
      const { results } = await presignRes.json();

      // results order matches filesPayload order; upload each with concurrency
      let idx = 0;
      const runNext = async () => {
        while (idx < results.length) {
          const i = idx++;
          const presigned = results[i];
          const item = queue[i];
          if (!presigned || !item) continue;

          updateItem(item.id, { status: "uploading", progress: 1 });
          try {
            // upload via presigned POST (form)
            await uploadFormWithProgress(presigned.url, presigned.fields, item.file, (p) => updateItem(item.id, { progress: p }));

            // register in DB
            const registerRes = await fetch(`/api/assets`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ key: presigned.key, filename: item.file.name, mime: item.file.type, size: item.file.size, folder, publicUrl: presigned.publicUrl }),
            });
            if (!registerRes.ok) throw new Error("Register failed");
            const registered = await registerRes.json();

            updateItem(item.id, { status: "done", progress: 100, key: presigned.key, publicUrl: registered.publicUrl || presigned.publicUrl });
          } catch (err: any) {
            updateItem(item.id, { status: "error", error: err.message || String(err) });
          }
        }
      };

      const workers: Promise<void>[] = [];
      for (let i = 0; i < Math.min(concurrency, results.length); i++) workers.push(runNext());
      await Promise.all(workers);
    } catch (err: any) {
      // mark all as error if batch presign failed
      queue.forEach((it) => updateItem(it.id, { status: "error", error: err.message || String(err) }));
    } finally {
      setRunning(false);
    }
  }

  function removeItem(id: string) {
    const it = items.find((i) => i.id === id);
    if (it?.preview) URL.revokeObjectURL(it.preview);
    setItems((s) => s.filter((i) => i.id !== id));
  }

  function clearCompleted() {
    items.forEach((it) => it.preview && URL.revokeObjectURL(it.preview));
    setItems((s) => s.filter((i) => i.status !== "done"));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="inline-flex items-center gap-2 rounded bg-white border px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 16.5V19a2 2 0 002 2h14a2 2 0 002-2v-2.5M16 7l-4-4m0 0L8 7m4-4v11" />
          </svg>
          <span className="text-sm text-gray-700">Select files…</span>
          <input type="file" multiple className="sr-only" onChange={(e) => handleFiles(e.target.files)} />
        </label>

        <div className="flex-1 text-sm text-gray-700">
          {items.length ? `${items.length} file(s) ready` : <span className="text-gray-400">No files selected</span>}
        </div>

        <button
          type="button"
          disabled={!items.some((i) => i.status === "idle") || running}
          onClick={startAll}
          className={`rounded px-3 py-1 text-sm text-white ${!items.some((i) => i.status === "idle") || running ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600"}`}
        >
          {running ? "Uploading..." : "Upload all"}
        </button>

        <button type="button" onClick={clearCompleted} className="ml-2 rounded px-3 py-1 bg-gray-100 text-sm">
          Clear completed
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {items.map((it) => (
          <div key={it.id} className="flex items-center gap-3 p-2 border rounded">
            <div className="w-16 h-12 bg-gray-50 rounded overflow-hidden flex items-center justify-center">
              {it.preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.preview} alt={it.file.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs text-gray-400">{it.file.name.split('.').pop()}</span>
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-center justify-between text-sm">
                <div className="font-medium">{it.file.name}</div>
                <div className="text-gray-500 text-xs">{Math.round(it.file.size / 1024)} KB</div>
              </div>

              <div className="mt-2">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div style={{ width: `${it.progress}%` }} className={`h-full bg-blue-600`} />
                </div>
                <div className="text-xs text-gray-500 mt-1">{it.status === "error" ? `Error: ${it.error}` : `${it.progress}%`}</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {it.status === "done" && it.publicUrl && (
                <a href={it.publicUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600">View</a>
              )}
              <button type="button" onClick={() => removeItem(it.id)} className="text-sm text-gray-500">Remove</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
