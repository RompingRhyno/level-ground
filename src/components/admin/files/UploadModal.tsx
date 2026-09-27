"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { prepareMedia, type EncodedRendition } from "@/lib/client/media-encode";
import { uploadWithProgress } from "@/lib/uploadWithProgress";
import { MEDIA_CACHE_CONTROL } from "@/lib/mime";
import { api, filesApi } from "./api";
import { formatBytes, type FolderData, type StorageInfo } from "./types";
import FolderPicker from "./FolderPicker";
import { useToast } from "./Toast";

type QueueItem = {
  id: string;
  file: File;
  status: "preparing" | "ready" | "uploading" | "done" | "error";
  progress: number;
  label?: string;
  error?: string;
  previewUrl?: string;
  encoded?: EncodedRendition[];
  meta?: Record<string, unknown>;
  publicUrl?: string;
};

type PresignResult = { filename: string; key: string; url: string; publicUrl: string | null };

const CONCURRENCY = 2;

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Upload flow: files are prepared in the browser (HEIC → JPEG, video → 720p/1080p + poster),
 * staged in a queue, then uploaded straight to R2 through presigned URLs.
 *
 * A folder is mandatory — either picked from the thumbnail list or created inline.
 */
export default function UploadModal({
  open,
  folders,
  initialFolder,
  lockedFolder = false,
  seedFiles,
  onClose,
  onFolderCreated,
  onUploaded,
}: {
  open: boolean;
  folders: FolderData[];
  initialFolder?: string | null;
  /**
   * Opened from a folder page: the destination is fixed, so the folder picker (search + cards)
   * is not rendered at all.
   */
  lockedFolder?: boolean;
  /** Files dropped onto a folder card, queued as soon as the modal opens. */
  seedFiles?: File[] | null;
  onClose: () => void;
  onFolderCreated: (folder: FolderData) => void;
  onUploaded: (summary: { folder: string; uploaded: number; failed: number }) => void;
}) {
  const toast = useToast();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [folderSlug, setFolderSlug] = useState<string | null>(initialFolder ?? null);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const prepareChain = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (!open) return;
    setFolderSlug(initialFolder ?? null);
    filesApi
      .storage()
      .then(setStorage)
      .catch(() => {});
  }, [open, initialFolder]);

  // Clean up object URLs when the modal unmounts
  useEffect(() => {
    return () => {
      setItems((current) => {
        current.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
        return [];
      });
    };
  }, []);

  const readyItems = useMemo(() => items.filter((item) => item.status === "ready"), [items]);
  const uploading = items.some((item) => item.status === "uploading");
  const preparing = items.some((item) => item.status === "preparing");

  const update = useCallback((id: string, patch: Partial<QueueItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const addFiles = useCallback(
    (fileList: FileList | File[] | null) => {
      if (!fileList) return;
      const files = Array.from(fileList).filter((file) => file.size > 0);
      if (!files.length) return;

      const queued: QueueItem[] = files.map((file) => ({
        id: newId(),
        file,
        status: "preparing",
        progress: 0,
        label: "Preparing…",
      }));
      setItems((current) => [...queued, ...current]);

      // Prepare sequentially: parallel WASM encodes are memory-hungry for large videos.
      for (const item of queued) {
        prepareChain.current = prepareChain.current.then(async () => {
          try {
            const prepared = await prepareMedia(
              item.file,
              (percent) => update(item.id, { progress: percent }),
              (label) => update(item.id, { label }),
            );
            update(item.id, {
              status: "ready",
              progress: 0,
              label: undefined,
              encoded: prepared.files,
              meta: prepared.meta,
              previewUrl: prepared.previewUrl,
            });
          } catch (err: any) {
            update(item.id, { status: "error", error: err?.message || String(err) });
          }
        });
      }
    },
    [update],
  );

  // Files dropped onto a folder card are queued as soon as the modal opens.
  useEffect(() => {
    if (!open || !seedFiles?.length) return;
    addFiles(seedFiles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, seedFiles]);

  async function uploadItem(item: QueueItem, slug: string): Promise<void> {
    const encoded = item.encoded ?? [];
    if (!encoded.length) throw new Error("Nothing to upload");

    const presign = await api<{ results: PresignResult[] }>("/api/assets/presign/batch", {
      method: "POST",
      body: JSON.stringify({
        folder: slug,
        files: encoded.map((entry) => ({ filename: entry.name, contentType: entry.mime })),
      }),
    });

    const totalBytes = encoded.reduce((total, entry) => total + entry.blob.size, 0) || 1;
    const uploadedByIndex = new Array(encoded.length).fill(0);

    update(item.id, { status: "uploading", progress: 0, label: "Uploading…" });

    await Promise.all(
      presign.results.map((result, index) =>
        uploadWithProgress(
          result.url,
          encoded[index].blob as File,
          encoded[index].mime,
          (percent) => {
            uploadedByIndex[index] = (encoded[index].blob.size * percent) / 100;
            const done = uploadedByIndex.reduce((total, value) => total + value, 0);
            update(item.id, { progress: Math.round((done / totalBytes) * 100) });
          },
          { "Cache-Control": MEDIA_CACHE_CONTROL },
        ),
      ),
    );

    const byRole = new Map<EncodedRendition["role"], { encoded: EncodedRendition; result: PresignResult }>();
    encoded.forEach((entry, index) => byRole.set(entry.role, { encoded: entry, result: presign.results[index] }));
    const primary = byRole.get("primary");
    if (!primary) throw new Error("Missing primary upload");

    const variant720 = byRole.get("720p")?.result.publicUrl ?? null;
    const variant1080 = primary.result.publicUrl ?? null;
    const poster = byRole.get("poster")?.result.publicUrl ?? null;
    const pendingMeta = (item.meta ?? {}) as Record<string, unknown>;
    const { variantsPending: _pending, ...meta } = pendingMeta;

    const registered = await api<{ id: string; publicUrl: string | null }>("/api/assets", {
      method: "POST",
      body: JSON.stringify({
        key: primary.result.key,
        filename: primary.encoded.name,
        mime: primary.encoded.mime,
        size: primary.encoded.blob.size,
        folder: slug,
        publicUrl: primary.result.publicUrl,
        width: primary.encoded.width ?? (item.meta as any)?.width ?? null,
        height: primary.encoded.height ?? (item.meta as any)?.height ?? null,
        meta: {
          ...meta,
          ...(variant720 || variant1080 ? { variants: { "720p": variant720, "1080p": variant1080 } } : {}),
          ...(poster ? { poster } : {}),
        },
      }),
    });

    update(item.id, {
      status: "done",
      progress: 100,
      label: undefined,
      publicUrl: registered.publicUrl ?? primary.result.publicUrl ?? undefined,
    });
  }

  async function startUpload() {
    if (!folderSlug) {
      toast({ kind: "error", message: "Choose a folder first", detail: "Every file belongs to a project folder." });
      return;
    }
    const queue = items.filter((item) => item.status === "ready");
    if (!queue.length) return;

    setBusy(true);
    let uploaded = 0;
    let failed = 0;
    let cursor = 0;

    const worker = async () => {
      while (cursor < queue.length) {
        const item = queue[cursor++];
        try {
          await uploadItem(item, folderSlug);
          uploaded++;
        } catch (err: any) {
          failed++;
          update(item.id, { status: "error", error: err?.message || String(err) });
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
    setBusy(false);

    if (uploaded) toast({ kind: "success", message: `Uploaded ${uploaded} file${uploaded === 1 ? "" : "s"}` });
    if (failed) toast({ kind: "error", message: `${failed} file${failed === 1 ? "" : "s"} failed`, detail: "Rows marked in red can be retried." });

    filesApi.storage().then(setStorage).catch(() => {});
    onUploaded({ folder: folderSlug, uploaded, failed });
    if (!failed) setItems((current) => current.filter((item) => item.status !== "done"));
  }

  async function handleCreateFolder(name: string, hidden: boolean): Promise<FolderData | null> {
    try {
      const created = await api<FolderData>("/api/folders", {
        method: "POST",
        body: JSON.stringify({ name, hidden }),
      });
      const withCounts: FolderData = { ...created, assetCount: 0, coverUrl: null };
      onFolderCreated(withCounts);
      toast({ kind: "success", message: `Folder “${created.name}” created` });
      return withCounts;
    } catch (err: any) {
      toast({ kind: "error", message: "Could not create folder", detail: err?.message });
      return null;
    }
  }

  if (!open) return null;

  const targetFolder = folders.find((folder) => folder.slug === folderSlug) ?? null;
  const storagePercent = storage ? Math.min(100, Math.round(storage.percentUsed * 100)) : 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget && !uploading) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Upload media"
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-semibold text-gray-800">Upload media</h2>
            <p className="text-xs text-gray-500">Photos upload as-is; videos are converted to web-friendly MP4 (720p + 1080p).</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none disabled:opacity-40"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
          <div className="text-sm text-gray-700">
            <span className="font-medium">Destination:</span>{" "}
            {targetFolder ? (
              <span className="text-(--color-brand-dark)">{targetFolder.name}</span>
            ) : (
              <span className="text-(--btn-negative-bg)">no folder selected</span>
            )}
          </div>

          {!lockedFolder && (
            <FolderPicker
              folders={folders}
              value={folderSlug}
              onChange={setFolderSlug}
              allowCreate
              onCreate={handleCreateFolder}
            />
          )}

          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              addFiles(event.dataTransfer.files);
            }}
            className={`rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm transition-colors ${
              dragging ? "border-(--btn-select) bg-(--color-bg-secondary)" : "border-(--color-border)"
            }`}
          >
            <p className="mb-2 text-gray-700">Drag files here, or</p>
            <label className="inline-flex items-center rounded px-3 py-1 text-sm btn-positive cursor-pointer">
              Select files…
              <input
                type="file"
                multiple
                accept="image/*,video/*,.heic,.heif"
                className="sr-only"
                onChange={(event) => {
                  addFiles(event.target.files);
                  event.target.value = "";
                }}
              />
            </label>
          </div>

          {items.length > 0 && (
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded border p-2">
                  <div className="w-14 h-10 rounded bg-(--color-bg-secondary) overflow-hidden shrink-0">
                    {item.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.previewUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="flex h-full items-center justify-center text-[10px] text-gray-500">
                        {item.file.name.split(".").pop()?.slice(0, 4)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate" title={item.file.name}>{item.file.name}</span>
                      <span className="text-xs text-gray-500 shrink-0">{formatBytes(item.file.size)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${item.status === "error" ? "bg-(--btn-negative-bg)" : item.status === "done" ? "bg-(--btn-positive-bg)" : "bg-blue-500"}`}
                        style={{ width: `${item.status === "done" ? 100 : item.progress}%` }}
                      />
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {item.status === "error" ? (
                        <span className="text-(--btn-negative-bg)">{item.error}</span>
                      ) : item.status === "done" ? (
                        "Uploaded"
                      ) : item.status === "uploading" ? (
                        `Uploading ${item.progress}%`
                      ) : item.status === "preparing" ? (
                        <span>
                          {item.label ?? "Preparing…"}
                          {item.progress > 0 && item.label === "Transcoding…" ? ` ${item.progress}%` : ""}
                        </span>
                      ) : (
                        "Ready to upload"
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={uploading || item.status === "done"}
                    onClick={() => {
                      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
                      setItems((current) => current.filter((entry) => entry.id !== item.id));
                    }}
                    className={`rounded px-2 py-1 text-xs ${uploading || item.status === "done" ? "bg-gray-300 text-gray-600" : "btn-negative"}`}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {storage && (
            <div className="text-xs text-gray-600">
              <div className="flex items-center justify-between">
                <span>
                  Library: {formatBytes(storage.bytesUsed)} of {formatBytes(storage.freeTierBytes)} free tier
                </span>
                <span>{storage.assetCount} files</span>
              </div>
              <div className="mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${storagePercent > 85 ? "bg-(--btn-negative-bg)" : "bg-(--color-brand-accent)"}`}
                  style={{ width: `${Math.max(2, storagePercent)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t">
          <span className="text-sm text-gray-600">
            {readyItems.length > 0
              ? `${readyItems.length} file${readyItems.length === 1 ? "" : "s"} ready`
              : preparing
                ? "Preparing…"
                : "No files queued"}
          </span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} disabled={uploading} className="rounded px-4 py-1.5 text-sm admin-btn disabled:opacity-50">
              {items.some((item) => item.status === "done") ? "Done" : "Cancel"}
            </button>
            <button
              type="button"
              disabled={busy || preparing || !readyItems.length || !folderSlug}
              onClick={startUpload}
              className={`rounded px-4 py-1.5 text-sm ${busy || preparing || !readyItems.length || !folderSlug ? "bg-gray-500 cursor-not-allowed text-white" : "btn-positive"}`}
            >
              {busy ? "Uploading…" : preparing ? "Converting…" : `Upload ${readyItems.length || ""}`.trim()}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
