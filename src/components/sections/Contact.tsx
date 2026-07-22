"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ContactSection } from "@/types/sections";
import { type UploadItem, uploadWithProgress } from "@/lib/uploadWithProgress";

declare global {
  interface Window {
    onTurnstileSuccess?: (token: string) => void;
  }
}

type Props = ContactSection & { pageSlug: string };

async function convertIfHeic(f: File): Promise<File> {
  const isHeic =
    f.type === "image/heic" ||
    f.type === "image/heif" ||
    /\.(heic|heif)$/i.test(f.name);
  if (!isHeic) return f;
  try {
    const heic2any = (await import("heic2any")).default;
    const blob = (await heic2any({ blob: f, toType: "image/jpeg", quality: 0.85 })) as Blob;
    const newName = f.name.replace(/\.(heic|heif)$/i, ".jpg");
    return new File([blob], newName, { type: "image/jpeg" });
  } catch (err) {
    console.warn("heic2any conversion failed, using original", err);
    return f;
  }
}

export default function Contact({
  id: sectionId,
  pageSlug,
  heading,
  subheading,
  image,
  fields,
  servicesHeading,
  serviceOptions,
  showUploader,
  uploaderLabel,
  submitLabel,
}: Props) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.id, ""]))
  );
  const [checkedServices, setCheckedServices] = useState<Set<string>>(new Set());
  const [turnstileToken, setTurnstileToken] = useState("");
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionIdRef = useRef<string | null>(null);

  // Load Turnstile widget
  useEffect(() => {
    window.onTurnstileSuccess = (token: string) => setTurnstileToken(token);
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!siteKey) return;
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
      delete window.onTurnstileSuccess;
    };
  }, []);

  function updateValue(id: string, val: string) {
    setValues((prev) => ({ ...prev, [id]: val }));
  }

  function toggleService(opt: string) {
    if (!serviceOptions?.includes(opt)) return;
    setCheckedServices((prev) => {
      const next = new Set(prev);
      if (next.has(opt)) next.delete(opt);
      else next.add(opt);
      return next;
    });
  }

  function updateUpload(id: string, patch: Partial<UploadItem>) {
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    const newItems: UploadItem[] = Array.from(fileList).map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      file,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      progress: 0,
      status: "idle" as const,
    }));
    setUploads((prev) => [...prev, ...newItems]);

    // Lazy session creation on first upload
    if (!sessionIdRef.current) {
      try {
        const sessionRes = await fetch("/api/contact/upload-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageSlug, sectionId }),
        });
        if (!sessionRes.ok) {
          const data = await sessionRes.json().catch(() => ({}));
          const msg = (data as { error?: string }).error ?? "Session creation failed";
          setUploads((prev) =>
            prev.map((u) =>
              newItems.some((n) => n.id === u.id)
                ? { ...u, status: "error" as const, error: msg }
                : u
            )
          );
          return;
        }
        const { sessionId } = await sessionRes.json();
        sessionIdRef.current = sessionId;
      } catch {
        setUploads((prev) =>
          prev.map((u) =>
            newItems.some((n) => n.id === u.id)
              ? { ...u, status: "error" as const, error: "Session creation failed" }
              : u
          )
        );
        return;
      }
    }

    const currentSessionId = sessionIdRef.current!;

    for (const item of newItems) {
      // Step 1 — Convert HEIC if needed
      updateUpload(item.id, { status: "converting" });
      let converted: File;
      try {
        converted = await convertIfHeic(item.file);
      } catch {
        converted = item.file;
      }

      // Step 2 — Request upload slot
      updateUpload(item.id, { status: "uploading", progress: 1 });
      try {
        const slotRes = await fetch("/api/contact/upload-session/slot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: currentSessionId,
            filename: converted.name,
            contentType: converted.type,
            size: converted.size,
          }),
        });
        if (!slotRes.ok) {
          const data = await slotRes.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error ?? "Slot allocation failed");
        }
        const { key, workerUrl, uploadToken } = await slotRes.json();

        // Step 3 — Upload via Cloudflare Worker
        await uploadWithProgress(workerUrl, converted, converted.type, (p) =>
          updateUpload(item.id, { progress: p }),
          { Authorization: `Bearer ${uploadToken}` }
        );

        // Step 4 — Confirm upload server-side
        const patchRes = await fetch("/api/contact/upload-session/slot", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: currentSessionId, key }),
        });
        if (!patchRes.ok) {
          const data = await patchRes.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error ?? "Upload confirmation failed");
        }

        updateUpload(item.id, { status: "done", progress: 100, key });
      } catch (err: unknown) {
        updateUpload(item.id, {
          status: "error",
          error: err instanceof Error ? err.message : "Upload failed",
        });
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Client-side required check (UX only)
    for (const field of fields) {
      if (field.required && !values[field.id]) {
        setError(`"${field.label}" is required.`);
        return;
      }
    }

    const photoKeys = uploads
      .filter((u) => u.status === "done" && u.key)
      .map((u) => u.key!);

    setLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageSlug,
          sectionId,
          values,
          services: [...checkedServices],
          photoKeys,
          sessionId: sessionIdRef.current ?? "",
          turnstileToken,
          _honeypot: "",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Submission failed");
      }
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex-1 flex">
        <div className="mx-auto max-w-2xl px-6 text-center" style={{ minHeight: "50svh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <h2
            className="heading text-3xl md:text-5xl font-light leading-tight mb-4"
            style={{ color: "var(--color-text-heading)" }}
          >
            Thank you!
          </h2>
          <p
            className="text-lg"
            style={{ fontFamily: "var(--font-body)", color: "var(--color-text-primary)" }}
          >
            Your message has been sent.
          </p>
          <div className="mt-6">
            <Link href="/" className="btn-primary">
              Return home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  return (
    <section className="mx-auto max-w-7xl px-6 py-20">
      {/* Heading — full width, above the grid so image aligns with first field */}
      <h2
        className="heading text-3xl md:text-5xl font-light leading-tight mb-6"
        style={{ color: "var(--color-text-heading)" }}
        dangerouslySetInnerHTML={{ __html: heading }}
      />
      {subheading && (
        <p
          className="mb-8 text-lg md:text-xl"
          style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-body)" }}
          dangerouslySetInnerHTML={{ __html: subheading }}
        />
      )}

      <div className={`grid items-start gap-12${image ? " md:grid-cols-[1fr_auto]" : ""}`}>
        {/* Form column */}
        <div className="max-w-full md:max-w-140">
      <form onSubmit={handleSubmit} className="space-y-4" style={{ color: "var(--color-text-heading)" }} noValidate>
        {/* Honeypot */}
        <input
          name="_honeypot"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          style={{ position: "absolute", opacity: 0, pointerEvents: "none", height: 0 }}
        />

        {/* Fields */}
        {fields.map((field) => (
          <div key={field.id}>
            <label className="block text-base font-medium mb-1" htmlFor={field.id}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
            </label>
            {field.type === "textarea" ? (
              <textarea
                id={field.id}
                required={field.required}
                placeholder={field.placeholder}
                value={values[field.id] ?? ""}
                onChange={(e) => updateValue(field.id, e.target.value)}
                rows={3}
                className="w-full rounded border px-3 py-2 text-sm bg-white placeholder:text-(--color-text-primary)"
              />
            ) : (
              <input
                id={field.id}
                type={field.type}
                required={field.required}
                placeholder={field.placeholder}
                value={values[field.id] ?? ""}
                onChange={(e) => updateValue(field.id, e.target.value)}
                className="w-full rounded border px-3 py-2 text-sm bg-white placeholder:text-(--color-text-primary)"
              />
            )}
          </div>
        ))}

        {/* Services */}
        {serviceOptions && serviceOptions.length > 0 && (
          <fieldset>
            <legend className="block text-base font-medium mb-1">
              {servicesHeading ?? "Services"}
            </legend>
            <div className="space-y-1">
              {serviceOptions.map((opt) => (
                <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkedServices.has(opt)}
                    onChange={() => toggleService(opt)}
                  />
                  {opt}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {/* Uploader */}
        {showUploader && (
          <div>
            <p className="text-base font-medium mb-1">{uploaderLabel ?? "Attach photos"}</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded border px-3 py-1 text-sm bg-white"
            >
              Choose files…
            </button>
            <p className="mt-2 text-xs text-(--color-text-primary)">Accepted: JPEG, PNG, WebP, HEIC — up to 10 MB per file.</p>
            {uploads.length > 0 && (
              <ul className="mt-2 space-y-1">
                {uploads.map((u) => (
                  <li key={u.id} className="text-xs flex items-center gap-2">
                    <span className="truncate max-w-50">{u.file.name}</span>
                    {u.status === "converting" && (
                      <span className="text-gray-500">Converting…</span>
                    )}
                    {u.status === "uploading" && (
                      <span className="text-gray-500">{u.progress}%</span>
                    )}
                    {u.status === "done" && <span className="text-green-600">✓</span>}
                    {u.status === "error" && (
                      <span className="text-red-500">{u.error}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Turnstile */}
        {siteKey && (
          <div
            className="cf-turnstile"
            data-sitekey={siteKey}
            data-callback="onTurnstileSuccess"
            data-theme="light"
          />
        )}

        {/* Error */}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary disabled:opacity-50"
          >
            {loading ? "Sending…" : (submitLabel ?? "Send message")}
          </button>
        </div>
      </form>
        </div>{/* end form column */}

        {/* Image column — right on md+, bottom-centered on narrow */}
        {image && (
          <div className="order-last flex justify-center md:order-0 md:justify-start">
            <div
              className="relative aspect-square w-80 sm:w-96 md:w-120 rounded-full shadow-xl"
              style={{ boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}
            >
              <Image
                src={image}
                alt=""
                fill
                sizes="(min-width:1024px) 480px, 384px"
                className="rounded-full object-cover"
              />
            </div>
          </div>
        )}
      </div>{/* end grid */}
    </section>
  );
}

