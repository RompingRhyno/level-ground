import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const CONTACT_UPLOAD_ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const CONTACT_UPLOAD_MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const CONTACT_UPLOAD_MAX_FILES = 5;
const PENDING_WINDOW_MS = 15 * 60 * 1000; // 15 min

function sanitiseFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/\.{2,}/g, "_")
    .slice(0, 100);
}

function bufToBase64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return Buffer.from(bin, "binary").toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

interface UploadTokenPayload {
  sessionId: string;
  key: string;
  expiresAt: string;
  contentType: string;
}

async function signUploadToken(payload: UploadTokenPayload, secret: string): Promise<string> {
  const encodedPayload = bufToBase64url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encodedPayload));
  return `${encodedPayload}.${bufToBase64url(sig)}`;
}

// ── POST — slot allocation ─────────────────────────────────────────────────

export async function POST(request: Request) {
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
  const { sessionId, filename, contentType, size } = raw;

  if (typeof sessionId !== "string" || !sessionId) {
    return NextResponse.json({ error: "INVALID_SESSION_ID" }, { status: 400 });
  }
  if (typeof filename !== "string" || !filename) {
    return NextResponse.json({ error: "INVALID_FILENAME" }, { status: 400 });
  }
  if (typeof contentType !== "string" || !CONTACT_UPLOAD_ALLOWED_MIME.has(contentType)) {
    return NextResponse.json({ error: "UPLOAD_INVALID_MIME" }, { status: 400 });
  }
  if (typeof size !== "number" || size < 1 || size > CONTACT_UPLOAD_MAX_SIZE) {
    return NextResponse.json({ error: "UPLOAD_INVALID_SIZE" }, { status: 400 });
  }

  const now = new Date();

  let session: { id: string; expiresAt: Date } | null;
  try {
    session = await prisma.contactUploadSession.findUnique({
      where: { id: sessionId },
      select: { id: true, expiresAt: true },
    });
  } catch {
    return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  }

  if (!session) {
    return NextResponse.json({ error: "SESSION_NOT_FOUND" }, { status: 404 });
  }
  if (session.expiresAt <= now) {
    return NextResponse.json({ error: "SESSION_EXPIRED" }, { status: 410 });
  }

  const uploadTokenSecret = process.env.UPLOAD_TOKEN_SECRET;
  const workerUrl = process.env.WORKER_URL;
  if (!uploadTokenSecret || !workerUrl) {
    return NextResponse.json({ error: "SERVER_MISCONFIGURED" }, { status: 500 });
  }

  const key = `contact-uploads/${sessionId}/${Date.now()}-${sanitiseFilename(filename)}`;
  const pendingCutoff = new Date(now.getTime() - PENDING_WINDOW_MS);

  // Atomic: count valid slots + insert
  try {
    await prisma.$transaction(
      async (tx) => {
        const count = await tx.contactUpload.count({
          where: {
            sessionId,
            OR: [
              { status: "uploaded" },
              { status: "pending", createdAt: { gt: pendingCutoff } },
            ],
          },
        });

        if (count >= CONTACT_UPLOAD_MAX_FILES) {
          throw Object.assign(new Error("MAX_FILES_REACHED"), { code: "MAX_FILES_REACHED" });
        }

        await tx.contactUpload.create({
          data: { sessionId, key, status: "pending" },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (err: unknown) {
    if (err instanceof Error && (err as { code?: string }).code === "MAX_FILES_REACHED") {
      return NextResponse.json({ error: "MAX_FILES_REACHED" }, { status: 409 });
    }
    console.error("[slot POST] transaction error:", err);
    return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  }

  const tokenPayload = {
    sessionId,
    key,
    expiresAt: session.expiresAt.toISOString(),
    contentType: contentType as string,
  };

  let uploadToken: string;
  try {
    uploadToken = await signUploadToken(tokenPayload, uploadTokenSecret);
  } catch {
    await prisma.contactUpload.deleteMany({ where: { key } }).catch(() => {});
    return NextResponse.json({ error: "TOKEN_SIGN_FAILED" }, { status: 500 });
  }

  const uploadEndpoint = new URL("/upload", workerUrl).toString();
  return NextResponse.json({ key, workerUrl: uploadEndpoint, uploadToken });
}

// ── PATCH — upload confirmation ────────────────────────────────────────────

export async function PATCH(request: Request) {
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
  const { sessionId, key } = raw;

  if (typeof sessionId !== "string" || !sessionId) {
    return NextResponse.json({ error: "INVALID_SESSION_ID" }, { status: 400 });
  }
  if (typeof key !== "string" || !key) {
    return NextResponse.json({ error: "INVALID_KEY" }, { status: 400 });
  }

  let slot: { status: string; sessionId: string; session: { expiresAt: Date } } | null;
  try {
    slot = await prisma.contactUpload.findUnique({
      where: { key },
      select: {
        status: true,
        sessionId: true,
        session: { select: { expiresAt: true } },
      },
    });
  } catch {
    return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  }

  if (!slot || slot.sessionId !== sessionId) {
    return NextResponse.json({ error: "SLOT_NOT_FOUND" }, { status: 404 });
  }

  // Idempotent: already confirmed
  if (slot.status === "uploaded") {
    return NextResponse.json({ ok: true });
  }

  // Terminal states cannot be re-confirmed
  if (slot.status === "used" || slot.status === "cleanup_failed") {
    return NextResponse.json({ error: "SLOT_ALREADY_TERMINAL" }, { status: 409 });
  }

  if (slot.status !== "pending") {
    return NextResponse.json({ error: "SLOT_INVALID_STATE" }, { status: 409 });
  }

  const now = new Date();
  if (slot.session.expiresAt <= now) {
    return NextResponse.json({ error: "SESSION_EXPIRED" }, { status: 410 });
  }

  try {
    await prisma.contactUpload.update({
      where: { key },
      data: { status: "uploaded" },
    });
  } catch {
    return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
