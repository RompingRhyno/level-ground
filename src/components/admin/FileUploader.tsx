"use client";
import React, { useEffect, useState } from "react";

type UploadItem = {
  id: string;
  file: File;
  preview?: string;
  progress: number;
  status: "converting" | "idle" | "uploading" | "done" | "error";
  error?: string;
  key?: string;
  publicUrl?: string;
};

export default function FileUploader({ folder = "" }: { folder?: string }) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [running, setRunning] = useState(false);
  const [startedUpload, setStartedUpload] = useState(false);
  const [concurrency] = useState(4);

  useEffect(() => {
    return () => {
      items.forEach((it) => it.preview && URL.revokeObjectURL(it.preview));
    };
  }, [items]);

  async function convertIfHeic(f: File): Promise<File> {
    const isHeic = f.type === 'image/heic' || f.type === 'image/heif' || /\.(heic|heif)$/i.test(f.name);
    if (!isHeic) return f;
    try {
      const heic2any = (await import('heic2any')).default;
      const blob = await heic2any({ blob: f, toType: 'image/jpeg', quality: 0.85 }) as Blob;
      const newName = f.name.replace(/\.(heic|heif)$/i, '.jpg');
      return new File([blob], newName, { type: 'image/jpeg' });
    } catch (err) {
      console.warn('heic2any conversion failed, using original', err);
      return f;
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const fileArray = Array.from(files);
    // Queue all files immediately with 'converting' status
    const next: UploadItem[] = fileArray.map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      file: f,
      preview: undefined,
      progress: 0,
      status: 'converting' as const,
    }));
    setItems((s) => [...next, ...s]);
    // Convert each in the background and update when ready
    next.forEach(async (item, i) => {
      const converted = await convertIfHeic(fileArray[i]);
      const preview = converted.type.startsWith('image/') ? URL.createObjectURL(converted) : undefined;
      updateItem(item.id, { file: converted, preview, status: 'idle' });
    });
  }

  function updateItem(id: string, patch: Partial<UploadItem>) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it))
    );
  }

  function uploadWithProgress(uploadUrl: string, file: File, contentType: string, onProgress: (p: number) => void) {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl, true);
      xhr.setRequestHeader("Content-Type", contentType);
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) onProgress(Math.round((ev.loaded / ev.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload failed: ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.send(file);
    });
  }

  function uploadFormWithProgress(
    actionUrl: string,
    fields: Record<string, string>,
    file: File,
    onProgress: (p: number) => void
  ) {
    return new Promise<Response>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", actionUrl, true);

      const form = new FormData();
      Object.entries(fields || {}).forEach(([k, v]) => form.append(k, v));
      form.append("file", file);

      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          onProgress(Math.round((ev.loaded / ev.total) * 100));
        }
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

  async function startAll() {
    if (!items.length) return;
    setRunning(true);
    setStartedUpload(true);

    const queue = items.filter((it) => it.status === "idle");

    if (!queue.length) {
      setRunning(false);
      return;
    }

    try {
      const filesPayload = queue.map((it) => ({
        filename: it.file.name,
        contentType: it.file.type,
      }));

      const presignRes = await fetch(`/api/assets/presign/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: filesPayload, folder }),
      });

      if (!presignRes.ok) throw new Error("Batch presign failed");

      const { results } = await presignRes.json();

      let idx = 0;

      const runNext = async () => {
        while (idx < results.length) {
          const i = idx++;
          const presigned = results[i];
          const item = queue[i];

          if (!presigned || !item) continue;

          updateItem(item.id, { status: "uploading", progress: 1 });

          try {
            // upload via presigned PUT
            await uploadWithProgress(
              presigned.url,
              item.file,
              item.file.type,
              (p) => updateItem(item.id, { progress: p })
            );

            const registerRes = await fetch(`/api/assets`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                key: presigned.key,
                filename: item.file.name,
                mime: item.file.type,
                size: item.file.size,
                folder,
                publicUrl: presigned.publicUrl,
              }),
            });

            if (!registerRes.ok) throw new Error("Register failed");

            const registered = await registerRes.json();

            updateItem(item.id, {
              status: "done",
              progress: 100,
              key: presigned.key,
              publicUrl: registered.publicUrl || presigned.publicUrl,
            });
          } catch (err: any) {
            updateItem(item.id, {
              status: "error",
              error: err.message || String(err),
            });
          }
        }
      };

      const workers: Promise<void>[] = [];

      for (let i = 0; i < Math.min(concurrency, results.length); i++) {
        workers.push(runNext());
      }

      await Promise.all(workers);
    } catch (err: any) {
      queue.forEach((it) =>
        updateItem(it.id, {
          status: "error",
          error: err.message || String(err),
        })
      );
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
        <label className="inline-flex items-center gap-2 rounded px-3 py-1 text-sm btn-positive focus:outline-none cursor-pointer">
          <span className="text-sm text-white">Select files…</span>
          <input
            type="file"
            multiple
            className="sr-only"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </label>

        <div className="flex-1 text-sm text-gray-700">
          {items.length
            ? `${items.length} file(s) ready`
            : "No files selected"}
        </div>

        <button
          type="button"
          disabled={!items.some((i) => i.status === "idle") || running || items.some((i) => i.status === "converting")}
          onClick={startAll}
          className={`rounded px-3 py-1 text-sm ${
            !items.some((i) => i.status === "idle") || running || items.some((i) => i.status === "converting")
              ? "bg-gray-500 cursor-not-allowed text-white"
              : "btn-positive"
          }`}
        >
          {items.some((i) => i.status === "converting") ? "Converting..." : running ? "Uploading..." : "Upload all"}
        </button>

        {startedUpload && !items.some((i) => i.status === 'uploading' || i.status === 'converting') && items.some((i) => i.status === 'done') && (
          <button
            type="button"
            onClick={clearCompleted}
            className="ml-2 rounded px-3 py-1 text-sm admin-btn"
          >
            Clear completed
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2">
        {items.map((it) => (
          <div key={it.id} className="flex items-center gap-3 p-2 border rounded bg-white shadow-sm">
            <div className="w-16 h-12 bg-gray-50 rounded overflow-hidden flex items-center justify-center">
              {it.preview ? (
                <img
                  src={it.preview}
                  alt={it.file.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs text-gray-400">
                  {it.file.name.split(".").pop()}
                </span>
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-center justify-between text-sm">
                <div className="font-medium">{it.file.name}</div>
                <div className="text-gray-500 text-xs">
                  {Math.round(it.file.size / 1024)} KB
                </div>
              </div>

              <div className="mt-2">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  {it.status === "converting" ? (
                    <div className="h-full bg-blue-400 animate-pulse w-full" />
                  ) : (
                    <div
                      style={{ width: `${it.progress}%` }}
                      className="h-full bg-blue-600"
                    />
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {it.status === "converting"
                    ? "Converting…"
                    : it.status === "error"
                    ? `Error: ${it.error}`
                    : `${it.progress}%`}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {it.status === "done" && it.publicUrl && (
                <a
                  href={it.publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-blue-600"
                >
                  View
                </a>
              )}
              <button
                type="button"
                onClick={() => removeItem(it.id)}
                className="ml-2 rounded px-2 py-1 text-sm btn-negative"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}