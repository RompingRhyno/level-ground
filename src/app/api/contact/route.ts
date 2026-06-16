import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { ContactFormField } from "@/types/sections";

// ── Types ──────────────────────────────────────────────────────────────────

type RawSection = Record<string, unknown>;

type ValidatedSection = {
  id: string;
  type: "contact";
  heading: string;
  subheading?: string;
  fields: ContactFormField[];
  servicesHeading?: string;
  serviceOptions?: string[];
  showUploader?: boolean;
  uploaderLabel?: string;
  submitLabel?: string;
  recipientIds: number[];
};

type ValidatedSubmissionContext = {
  values: Record<string, string>;
  services: string[];
  photoKeys: string[];
};

type ResolvedRecipients = { id: number; email: string; name: string | null }[];

// ── CMS validator ──────────────────────────────────────────────────────────

const FIELD_TYPES = new Set(["text", "email", "tel", "textarea"]);

function validateCmsSection(section: RawSection): { ok: true; value: ValidatedSection } | { ok: false; error: string } {
  if (typeof section.id !== "string" || !section.id) return { ok: false, error: "CMS_INVALID_ID" };
  if (section.type !== "contact") return { ok: false, error: "CMS_INVALID_TYPE" };
  if (!Array.isArray(section.fields)) return { ok: false, error: "CMS_INVALID_FIELDS" };

  const seenIds = new Set<string>();
  for (const f of section.fields) {
    if (typeof f !== "object" || f === null) return { ok: false, error: "CMS_INVALID_FIELD_ELEMENT" };
    const field = f as Record<string, unknown>;
    if (typeof field.id !== "string" || !field.id) return { ok: false, error: "CMS_INVALID_FIELD_ID" };
    if (seenIds.has(field.id)) return { ok: false, error: "CMS_DUPLICATE_FIELD_ID" };
    seenIds.add(field.id);
    if (typeof field.label !== "string") return { ok: false, error: "CMS_INVALID_FIELD_LABEL" };
    if (!FIELD_TYPES.has(field.type as string)) return { ok: false, error: "CMS_INVALID_FIELD_TYPE" };
    if (typeof field.required !== "boolean") return { ok: false, error: "CMS_INVALID_FIELD_REQUIRED" };
  }

  if (!Array.isArray(section.recipientIds) || section.recipientIds.length === 0) {
    return { ok: false, error: "CMS_INVALID_RECIPIENT_IDS" };
  }
  for (const id of section.recipientIds) {
    if (!Number.isFinite(id) || !Number.isInteger(id)) return { ok: false, error: "CMS_INVALID_RECIPIENT_ID_VALUE" };
  }

  if (section.serviceOptions !== undefined) {
    if (!Array.isArray(section.serviceOptions)) return { ok: false, error: "CMS_INVALID_SERVICE_OPTIONS" };
    for (const opt of section.serviceOptions) {
      if (typeof opt !== "string" || !opt) return { ok: false, error: "CMS_INVALID_SERVICE_OPTION_VALUE" };
    }
  }

  return {
    ok: true,
    value: section as unknown as ValidatedSection,
  };
}

// ── Submission validator ───────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTACT_KEY_REGEX = /^contact-uploads\/[0-9a-f-]{36}\/\d+-[^/]+$/;
const CONTACT_UPLOAD_MAX_FILES = 5;

function validateSubmission(
  values: Record<string, string>,
  services: string[],
  photoKeys: string[],
  section: ValidatedSection,
): { ok: true; value: ValidatedSubmissionContext } | { ok: false; error: string } {
  // Field rules
  for (const field of section.fields) {
    const val = values[field.id] ?? "";
    if (field.required && !val) return { ok: false, error: "SUB_REQUIRED_FIELD_MISSING" };
    if (field.type === "email" && val && !EMAIL_REGEX.test(val)) return { ok: false, error: "SUB_INVALID_EMAIL_FORMAT" };
    const limit = field.type === "textarea" ? 5000 : 1000;
    if (val.length > limit) return { ok: false, error: "SUB_VALUE_TOO_LONG" };
  }

  // Services rules
  if (!section.serviceOptions || section.serviceOptions.length === 0) {
    if (services.length > 0) return { ok: false, error: "SUB_SERVICES_NOT_ALLOWED" };
  } else {
    const allowed = new Set(section.serviceOptions);
    for (const s of services) {
      if (!allowed.has(s)) return { ok: false, error: "SUB_INVALID_SERVICE" };
    }
  }

  // Photo key count guard
  if (photoKeys.length > CONTACT_UPLOAD_MAX_FILES) {
    return { ok: false, error: "SUB_TOO_MANY_PHOTOS" };
  }

  // Key format validation (structural defense-in-depth)
  for (const key of photoKeys) {
    if (!CONTACT_KEY_REGEX.test(key)) return { ok: false, error: "SUB_INVALID_KEY_FORMAT" };
  }

  return { ok: true, value: { values, services, photoKeys } };
}

// ── Email serializer ───────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function serializeEmailContent(ctx: {
  section: ValidatedSection;
  submission: ValidatedSubmissionContext;
  recipients: ResolvedRecipients;
  photoUrls: string[];
}): { subject: string; html: string; to: string[] } {
  const { section, submission, photoUrls } = ctx;

  const subject = "New contact form submission";

  const rows = section.fields
    .map((f) => {
      const val = submission.values[f.id] ?? "";
      return `<tr><td style="padding:4px 8px;font-weight:600;vertical-align:top">${escapeHtml(f.label)}</td><td style="padding:4px 8px">${escapeHtml(val)}</td></tr>`;
    })
    .join("");

  const servicesHeading = (section.servicesHeading ?? "Services").replace(/:$/, "");
  const servicesBlock =
    submission.services.length > 0
      ? `<p><strong>${escapeHtml(servicesHeading)}:</strong> ${submission.services.map(escapeHtml).join(", ")}</p>`
      : "";

  const photosBlock =
    photoUrls.length > 0
      ? `<div style="margin-top:16px"><strong>Attached photos:</strong><br>${photoUrls
        .map((u) => `<img src="${escapeHtml(u)}" style="max-width:400px;max-height:300px;display:block;margin:8px 0" alt="">`)
        .join("")}</div>`
      : "";

  const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px">
<table>${rows}</table>
${servicesBlock}
${photosBlock}
</body></html>`;

  const to = ctx.recipients.map((r) => r.email);

  return { subject, html, to };
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // Step 0 — Transport shape guard
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;
  const ALLOWED_KEYS = new Set(["pageSlug", "sectionId", "values", "services", "photoKeys", "sessionId", "turnstileToken", "_honeypot"]);
  for (const key of Object.keys(raw)) {
    if (!ALLOWED_KEYS.has(key)) return NextResponse.json({ error: "UNKNOWN_FIELD" }, { status: 400 });
  }
  for (const key of ALLOWED_KEYS) {
    if (!(key in raw)) return NextResponse.json({ error: "MISSING_FIELD" }, { status: 400 });
  }

  const { pageSlug, sectionId, values, services, photoKeys, sessionId, turnstileToken, _honeypot } = raw;

  if (typeof pageSlug !== "string") return NextResponse.json({ error: "INVALID_PAGE_SLUG" }, { status: 400 });
  if (typeof sectionId !== "string") return NextResponse.json({ error: "INVALID_SECTION_ID" }, { status: 400 });
  if (typeof sessionId !== "string") return NextResponse.json({ error: "INVALID_SESSION_ID" }, { status: 400 });
  if (typeof turnstileToken !== "string") return NextResponse.json({ error: "INVALID_TURNSTILE_TOKEN" }, { status: 400 });
  if (typeof _honeypot !== "string") return NextResponse.json({ error: "INVALID_HONEYPOT" }, { status: 400 });

  if (typeof values !== "object" || values === null || Array.isArray(values)) {
    return NextResponse.json({ error: "INVALID_VALUES" }, { status: 400 });
  }
  for (const v of Object.values(values as Record<string, unknown>)) {
    if (typeof v !== "string") return NextResponse.json({ error: "INVALID_VALUES_ENTRY" }, { status: 400 });
  }

  if (!Array.isArray(services)) return NextResponse.json({ error: "INVALID_SERVICES" }, { status: 400 });
  for (const s of services) {
    if (typeof s !== "string") return NextResponse.json({ error: "INVALID_SERVICES_ENTRY" }, { status: 400 });
  }

  if (!Array.isArray(photoKeys)) return NextResponse.json({ error: "INVALID_PHOTO_KEYS" }, { status: 400 });
  for (const k of photoKeys) {
    if (typeof k !== "string") return NextResponse.json({ error: "INVALID_PHOTO_KEY_ENTRY" }, { status: 400 });
  }

  const typedValues = values as Record<string, string>;
  const typedServices = services as string[];
  const typedPhotoKeys = photoKeys as string[];
  const typedSessionId = sessionId as string;

  // Step 1 — Honeypot
  if (_honeypot !== "") {
    return NextResponse.json({ ok: true });
  }

  // Step 2 — Turnstile
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  if (!turnstileSecret) {
    return NextResponse.json({ error: "SERVER_MISCONFIGURED" }, { status: 500 });
  }

  let turnstileRes: Response;
  try {
    const ip =
      request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

    const formData = new URLSearchParams({
      secret: turnstileSecret,
      response: turnstileToken,
    });

    if (ip) {
      formData.set("remoteip", ip);
    }

    turnstileRes = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
      }
    );
  } catch {
    return NextResponse.json({ error: "TURNSTILE_UNREACHABLE" }, { status: 502 });
  }

  if (!turnstileRes.ok) {
    return NextResponse.json({ error: "TURNSTILE_UNREACHABLE" }, { status: 502 });
  }

  let turnstileData: unknown;
  try {
    turnstileData = await turnstileRes.json();
  } catch {
    return NextResponse.json({ error: "TURNSTILE_UNREACHABLE" }, { status: 502 });
  }

  if (typeof turnstileData !== "object" || turnstileData === null) {
    return NextResponse.json({ error: "TURNSTILE_FAILED" }, { status: 400 });
  }

  const result = turnstileData as Record<string, unknown>;

  if (result.success !== true) {
    return NextResponse.json({ error: "TURNSTILE_FAILED" }, { status: 400 });
  }

  // Step 3 — Load page
  let page: { sections: unknown } | null;
  try {
    page = await prisma.page.findUnique({ where: { slug: pageSlug } });
  } catch {
    return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  }

  if (!page) {
    return NextResponse.json({ error: "PAGE_NOT_FOUND" }, { status: 404 });
  }

  // Step 4 — Navigate to section
  if (!Array.isArray(page.sections)) {
    return NextResponse.json({ error: "CMS_SECTIONS_NOT_ARRAY" }, { status: 400 });
  }

  for (const el of page.sections) {
    if (typeof el !== "object" || el === null) {
      return NextResponse.json({ error: "CMS_INVALID_SECTION_ELEMENT" }, { status: 400 });
    }
  }

  const rawSection = (page.sections as RawSection[]).find((s) => s.id === sectionId);
  if (!rawSection) {
    return NextResponse.json({ error: "CMS_SECTION_NOT_FOUND" }, { status: 400 });
  }

  // Step 5 — CMS validation
  const cmsResult = validateCmsSection(rawSection);
  if (!cmsResult.ok) {
    return NextResponse.json({ error: cmsResult.error }, { status: 400 });
  }
  const validatedSection = cmsResult.value;

  // Step 6 — Submission validation (fields + services + key format)
  const subResult = validateSubmission(typedValues, typedServices, typedPhotoKeys, validatedSection);
  if (!subResult.ok) {
    return NextResponse.json({ error: subResult.error }, { status: 400 });
  }
  const validatedSubmission = subResult.value;

  // Step 7 — Recipient referential integrity
  const uniqueIds = [...new Set(validatedSection.recipientIds)];
  let resolvedRecipients: ResolvedRecipients;
  try {
    resolvedRecipients = await prisma.contactRecipient.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, email: true, name: true },
    });
  } catch {
    return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  }

  const foundIds = new Set(resolvedRecipients.map((r) => r.id));
  for (const id of uniqueIds) {
    if (!foundIds.has(id)) return NextResponse.json({ error: "RECIPIENT_NOT_FOUND" }, { status: 400 });
  }

  // Step 7a — Photo session + key ownership validation
  let photoUrls: string[] = [];

  if (typedPhotoKeys.length > 0) {
    if (!typedSessionId) {
      return NextResponse.json({ error: "SESSION_REQUIRED_FOR_PHOTOS" }, { status: 400 });
    }

    const r2Base = process.env.R2_BASE_URL;
    if (!r2Base) {
      return NextResponse.json({ error: "SERVER_MISCONFIGURED" }, { status: 500 });
    }

    let uploadSession: { sectionId: string; expiresAt: Date } | null;
    try {
      uploadSession = await prisma.contactUploadSession.findUnique({
        where: { id: typedSessionId },
        select: { sectionId: true, expiresAt: true },
      });
    } catch {
      return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
    }

    if (!uploadSession) {
      return NextResponse.json({ error: "SESSION_NOT_FOUND" }, { status: 400 });
    }
    if (uploadSession.expiresAt <= new Date()) {
      return NextResponse.json({ error: "SESSION_EXPIRED" }, { status: 400 });
    }
    if (uploadSession.sectionId !== sectionId) {
      return NextResponse.json({ error: "SESSION_MISMATCH" }, { status: 400 });
    }

    // Step 7b — Verify all keys are uploaded and owned by this session
    let uploadedSlots: { key: string }[];
    try {
      uploadedSlots = await prisma.contactUpload.findMany({
        where: {
          sessionId: typedSessionId,
          key: { in: typedPhotoKeys },
          status: "uploaded",
        },
        select: { key: true },
      });
    } catch {
      return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
    }

    if (uploadedSlots.length !== typedPhotoKeys.length) {
      return NextResponse.json({ error: "PHOTO_KEY_INVALID" }, { status: 400 });
    }

    photoUrls = typedPhotoKeys.map((k) => `${r2Base.replace(/\/$/, "")}/${k}`);
  }

  // Step 8 — Serialize and send
  const { subject, html, to } = serializeEmailContent({
    section: validatedSection,
    submission: validatedSubmission,
    recipients: resolvedRecipients,
    photoUrls,
  });

  const resendKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.CONTACT_EMAIL_FROM;
  if (!resendKey || !fromAddress) {
    return NextResponse.json({ error: "SERVER_MISCONFIGURED" }, { status: 500 });
  }

  const { Resend } = await import("resend");
  const resend = new Resend(resendKey);

  // Fetch uploaded photos as attachments (failures are non-fatal)
  const attachments: { filename: string; content: string; content_type: string }[] = [];
  await Promise.all(
    photoUrls.map(async (url) => {
      try {
        const fetchRes = await fetch(url, { signal: AbortSignal.timeout(10_000) });
        if (!fetchRes.ok) return;
        const contentType = fetchRes.headers.get("content-type") ?? "image/jpeg";
        const buffer = await fetchRes.arrayBuffer();
        const content = Buffer.from(buffer).toString("base64");
        const filename = url.split("/").pop()?.split("?")[0] ?? "photo";
        attachments.push({ filename, content, content_type: contentType });
      } catch {
        // skip — don't block email send on a failed attachment fetch
      }
    })
  );

  const { error: resendError } = await resend.emails.send({
    from: fromAddress,
    to,
    subject,
    html,
    ...(attachments.length > 0 && { attachments }),
  });

  if (resendError) {
    console.error("[contact] Resend error:", resendError);
    return NextResponse.json({ error: "EMAIL_SEND_FAILED" }, { status: 500 });
  }

  // Step 9 — Mark keys as used (replay prevention)
  if (typedPhotoKeys.length > 0) {
    await prisma.contactUpload
      .updateMany({
        where: { key: { in: typedPhotoKeys } },
        data: { status: "used" },
      })
      .catch((err: unknown) => console.error("[contact] Failed to mark keys as used:", err));
  }

  return NextResponse.json({ ok: true });
}
