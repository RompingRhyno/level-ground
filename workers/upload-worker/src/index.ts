export interface Env {
  R2_BUCKET: R2Bucket;
  UPLOAD_TOKEN_SECRET: string;
  ALLOWED_ORIGIN: string;
}

function base64urlToBuf(s: string): ArrayBuffer {
  const padded = s
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(s.length + ((4 - (s.length % 4)) % 4), "=");

  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

interface UploadTokenPayload {
  sessionId: string;
  key: string;
  expiresAt: string;
  contentType: string;
}

async function verifyToken(
  token: string,
  secret: string,
): Promise<UploadTokenPayload | null> {
  const dotIdx = token.lastIndexOf(".");
  if (dotIdx < 1) return null;

  const encodedPayload = token.slice(0, dotIdx);
  const receivedSig = token.slice(dotIdx + 1);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const valid = await crypto.subtle.verify(
    "HMAC",
    keyMaterial,
    base64urlToBuf(receivedSig),
    new TextEncoder().encode(encodedPayload),
  );
  if (!valid) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(base64urlToBuf(encodedPayload)));
  } catch {
    return null;
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    typeof (payload as Record<string, unknown>).sessionId !== "string" ||
    typeof (payload as Record<string, unknown>).key !== "string" ||
    typeof (payload as Record<string, unknown>).expiresAt !== "string" ||
    typeof (payload as Record<string, unknown>).contentType !== "string"
  ) {
    return null;
  }

  const typed = payload as UploadTokenPayload;
  const exp = Date.parse(typed.expiresAt);
  if (Number.isNaN(exp) || exp <= Date.now()) return null;

  return typed;
}

function corsHeaders(origin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(env: Env, body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(env.ALLOWED_ORIGIN),
    },
  });
}

const MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const cors = corsHeaders(env.ALLOWED_ORIGIN);
      const url = new URL(request.url);

      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: cors });
      }

      if (url.pathname !== "/upload") {
        return json(env, { error: "NOT_FOUND" }, 404);
      }

      if (request.method !== "PUT") {
        return json(env, { error: "METHOD_NOT_ALLOWED" }, 405);
      }

      const authHeader = request.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return json(env, { error: "UNAUTHORIZED" }, 401);
      }

      const payload = await verifyToken(authHeader.slice(7), env.UPLOAD_TOKEN_SECRET);
      if (!payload) {
        return json(env, { error: "UNAUTHORIZED" }, 401);
      }

      const contentType = request.headers.get("Content-Type") ?? "";
      if (!ALLOWED_MIME.has(contentType)) {
        return json(env, { error: "UNSUPPORTED_MEDIA_TYPE" }, 415);
      }

      if (contentType !== payload.contentType) {
        return json(env, { error: "CONTENT_TYPE_MISMATCH" }, 415);
      }

      if (!request.body) {
        return json(env, { error: "EMPTY_BODY" }, 400);
      }

      const reader = request.body.getReader();
      const chunks: Uint8Array[] = [];
      let bytesRead = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          bytesRead += value.byteLength;

          if (bytesRead > MAX_BYTES) {
            await reader.cancel();
            return json(env, { error: "PAYLOAD_TOO_LARGE" }, 413);
          }

          chunks.push(value);
        }
      } catch (err) {
        console.error("[upload-worker] Body read failed:", err);
        return json(env, { error: "BODY_READ_FAILED" }, 500);
      }

      try {
        const body = new Blob(chunks, { type: contentType });

        await env.R2_BUCKET.put(payload.key, body, {
          httpMetadata: { contentType },
        });
      } catch (err) {
        console.error("[upload-worker] R2 put failed:", err);
        return json(env, { error: "UPLOAD_FAILED" }, 500);
      }

      return json(env, { ok: true }, 200);
    } catch (err) {
      console.error("[upload-worker] Unhandled error:", err);
      return json(env, { error: "INTERNAL_ERROR" }, 500);
    }
  },
} satisfies ExportedHandler<Env>;