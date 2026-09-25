"use client";

import { useEffect, useState } from "react";
import { filenameStem, formatBytes, isVideoAsset, type AssetData } from "./types";

/** Asset preview with metadata and the actions that are actually useful day to day. */
export default function Lightbox({
  asset,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: {
  asset: AssetData;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && hasPrev) onPrev();
      if (event.key === "ArrowRight" && hasNext) onNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext, hasPrev, hasNext]);

  useEffect(() => setCopied(false), [asset.id]);

  async function copyUrl() {
    if (!asset.publicUrl) return;
    try {
      await navigator.clipboard.writeText(asset.publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const meta = (asset.meta ?? {}) as Record<string, unknown>;
  const variants = (meta.variants as Record<string, string | null> | undefined) ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-label={asset.filename ?? "Asset"}>
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      <div className="relative z-10 flex max-h-[92vh] w-[min(1100px,94vw)] flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <div className="truncate font-medium text-(--color-brand-dark)">
              {filenameStem(asset)}
              <span className="text-gray-400">{asset.filename?.slice(filenameStem(asset).length)}</span>
            </div>
            <div className="text-xs text-gray-500">
              {formatBytes(asset.size)}
              {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ""}
              {asset.folder ? ` · ${asset.folder}` : ""}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {asset.publicUrl && (
              <>
                <button type="button" onClick={copyUrl} className="rounded border px-3 py-1 text-sm hover:bg-gray-50">
                  {copied ? "Copied" : "Copy URL"}
                </button>
                <a
                  href={asset.publicUrl}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
                >
                  Download
                </a>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded px-2 py-1 text-xl leading-none text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center bg-black/5 p-4">
          {asset.publicUrl ? (
            isVideoAsset(asset) ? (
              <video
                src={asset.publicUrl}
                poster={(meta.poster as string) ?? undefined}
                controls
                playsInline
                className="max-h-[62vh] max-w-full"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={asset.publicUrl} alt={asset.alt ?? ""} className="max-h-[62vh] max-w-full object-contain" />
            )
          ) : (
            <p className="text-sm text-gray-600">No preview available for this file.</p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-xs text-gray-600">
          <div className="space-y-0.5">
            {asset.alt && <div>Alt: {asset.alt}</div>}
            {asset.usedOn && asset.usedOn.length > 0 && (
              <div className="text-(--color-brand-dark)">
                Used on: {asset.usedOn.join(", ")}
              </div>
            )}
            {variants && (
              <div>
                Variants:{" "}
                {Object.entries(variants)
                  .filter(([, url]) => !!url)
                  .map(([label]) => label)
                  .join(", ") || "none"}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!hasPrev}
              onClick={onPrev}
              className={`rounded border px-3 py-1 text-sm ${hasPrev ? "hover:bg-gray-50" : "opacity-40"}`}
            >
              ← Prev
            </button>
            <button
              type="button"
              disabled={!hasNext}
              onClick={onNext}
              className={`rounded border px-3 py-1 text-sm ${hasNext ? "hover:bg-gray-50" : "opacity-40"}`}
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
