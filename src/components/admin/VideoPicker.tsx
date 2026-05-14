"use client";
import { useEffect, useState } from "react";

type Asset = { id: string; publicUrl: string | null; filename: string | null; mime: string | null };

function VideoPickerModal({
  onPick,
  onClose,
}: {
  onPick: (url: string) => void;
  onClose: () => void;
}) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch("/api/assets")
      .then((r) => r.json())
      .then((d: Asset[]) =>
        setAssets((d || []).filter((a) => /^video\//i.test(a.mime || "")))
      )
      .catch(() => setAssets([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-gray-800">Choose video</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : assets.length === 0 ? (
            <div className="text-sm text-gray-500">No video assets found.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {assets.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  disabled={!a.publicUrl}
                  onClick={() => {
                    if (a.publicUrl) {
                      onPick(a.publicUrl);
                      onClose();
                    }
                  }}
                  className="relative aspect-video rounded overflow-hidden border-2 border-transparent hover:border-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-40 bg-gray-900"
                  title={a.filename ?? a.id}
                >
                  {a.publicUrl && (
                    <video
                      src={a.publicUrl}
                      className="w-full h-full object-cover"
                      preload="metadata"
                      muted
                      playsInline
                    />
                  )}
                  <span className="absolute bottom-1 left-1 right-1 text-xs text-white text-left truncate bg-black/50 px-1 rounded">
                    {a.filename ?? a.id}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VideoPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-start gap-3">
      {value ? (
        <div className="relative w-48 aspect-video rounded overflow-hidden border border-gray-200 shrink-0 bg-gray-900">
          <video
            src={value}
            className="w-full h-full object-cover"
            preload="metadata"
            muted
            playsInline
          />
        </div>
      ) : (
        <div className="w-48 aspect-video rounded border border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400 shrink-0">
          No video
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded border px-3 py-1 text-sm transition-colors self-start"
          style={{
            backgroundColor: "white",
            color: "var(--color-brand-dark)",
            borderColor: "var(--color-brand-dark)",
          }}
        >
          {value ? "Change video…" : "Choose video…"}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-sm text-red-500 hover:text-red-700 self-start"
          >
            Remove
          </button>
        )}
      </div>
      {open && (
        <VideoPickerModal onPick={onChange} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}
