import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { ContactFormField, ContactSection } from "@/types/sections";

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
  photoUrls: string[];
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

function validateSubmission(
  values: Record<string, string>,
  services: string[],
  photoUrls: string[],
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

  // URL rules
  const r2BaseUrl = process.env.R2_BASE_URL;
  if (!r2BaseUrl) throw new Error("R2_BASE_URL not configured");
  const r2Origin = new URL(r2BaseUrl).origin.toLowerCase();

  for (const rawUrl of photoUrls) {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return { ok: false, error: "SUB_INVALID_PHOTO_URL" };
    }
    const normalizedOrigin = `${parsed.protocol.toLowerCase()}//${parsed.host.toLowerCase()}`;
    if (normalizedOrigin !== r2Origin) return { ok: false, error: "SUB_PHOTO_URL_ORIGIN_MISMATCH" };
    if (!parsed.pathname.startsWith("/contact-uploads/")) return { ok: false, error: "SUB_PHOTO_URL_PATH_INVALID" };
  }

  return { ok: true, value: { values, services, photoUrls } };
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
}): { subject: string; html: string; to: string[] } {
  const { section, submission } = ctx;

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
    submission.photoUrls.length > 0
      ? `<div style="margin-top:16px"><strong>Attached photos:</strong><br>${submission.photoUrls
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
  const ALLOWED_KEYS = new Set(["pageSlug", "sectionId", "values", "services", "photoUrls", "turnstileToken", "_honeypot"]);
  for (const key of Object.keys(raw)) {
    if (!ALLOWED_KEYS.has(key)) return NextResponse.json({ error: "UNKNOWN_FIELD" }, { status: 400 });
  }
  for (const key of ALLOWED_KEYS) {
    if (!(key in raw)) return NextResponse.json({ error: "MISSING_FIELD" }, { status: 400 });
  }

  const { pageSlug, sectionId, values, services, photoUrls, turnstileToken, _honeypot } = raw;

  if (typeof pageSlug !== "string") return NextResponse.json({ error: "INVALID_PAGE_SLUG" }, { status: 400 });
  if (typeof sectionId !== "string") return NextResponse.json({ error: "INVALID_SECTION_ID" }, { status: 400 });
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

  if (!Array.isArray(photoUrls)) return NextResponse.json({ error: "INVALID_PHOTO_URLS" }, { status: 400 });
  for (const u of photoUrls) {
    if (typeof u !== "string") return NextResponse.json({ error: "INVALID_PHOTO_URL_ENTRY" }, { status: 400 });
  }

  const typedValues = values as Record<string, string>;
  const typedServices = services as string[];
  const typedPhotoUrls = photoUrls as string[];

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
    turnstileRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: turnstileSecret, response: turnstileToken }),
    });
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

  if (
    typeof turnstileData !== "object" ||
    turnstileData === null ||
    !(turnstileData as Record<string, unknown>).success
  ) {
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

  // Step 6 — Submission validation
  const subResult = validateSubmission(typedValues, typedServices, typedPhotoUrls, validatedSection);
  if (!subResult.ok) {
    return NextResponse.json({ error: subResult.error }, { status: 400 });
  }
  const validatedSubmission = subResult.value;

  // Step 7 — Referential integrity (DB only)
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

  // Step 8 — Serialize and send
  const { subject, html, to } = serializeEmailContent({
    section: validatedSection,
    submission: validatedSubmission,
    recipients: resolvedRecipients,
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
    validatedSubmission.photoUrls.map(async (url) => {
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

  return NextResponse.json({ ok: true });
}
