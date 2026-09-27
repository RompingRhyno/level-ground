export interface Env {
  R2_BUCKET: R2Bucket;
  UPLOAD_TOKEN_SECRET: string;
  /** Comma-separated list of origins allowed to PUT. `https://*.example.com` matches any subdomain. */
  ALLOWED_ORIGINS: string;
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

/**
 * Origin matching for CORS. Exact entries match literally; entries containing `*.` match any
 * subdomain (`https://*.vercel.app` covers preview deployments and production aliases).
 */
function originAllowed(origin: string | null, allowList: string): boolean {
  if (!origin) return false;
  return allowList
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .some((entry) => {
      if (!entry.includes("*.")) return entry === origin;
      const [schemeAndHost, ...rest] = entry.split("*.");
      const suffix = rest.join("*.");
      return origin.startsWith(schemeAndHost) && origin.endsWith(`.${suffix}`);
    });
}

function corsHeaders(origin: string | null, allowList: string): HeadersInit {
  if (!originAllowed(origin, allowList)) {
    // No Access-Control-Allow-Origin: the browser refuses the request. Vary keeps caches honest.
    return { Vary: "Origin" };
  }
  return {
    "Access-Control-Allow-Origin": origin as string,
    "Access-Control-Allow-Methods": "PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body: unknown, status: number, headers: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
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

/**
 * Customer photos sent through the contact form are public until the lifecycle rule removes them
 * (60 days), so keep client caches short — nothing here is worth a long-lived copy on a device.
 */
const CACHE_CONTROL = "public, max-age=600";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const cors = corsHeaders(request.headers.get("Origin"), env.ALLOWED_ORIGINS);
      const url = new URL(request.url);

      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: cors });
      }

      if (url.pathname !== "/upload") {
        return json({ error: "NOT_FOUND" }, 404, cors);
      }

      if (request.method !== "PUT") {
        return json({ error: "METHOD_NOT_ALLOWED" }, 405, cors);
      }

      const authHeader = request.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return json({ error: "UNAUTHORIZED" }, 401, cors);
      }

      const payload = await verifyToken(authHeader.slice(7), env.UPLOAD_TOKEN_SECRET);
      if (!payload) {
        return json({ error: "UNAUTHORIZED" }, 401, cors);
      }

      const contentType = request.headers.get("Content-Type") ?? "";
      if (!ALLOWED_MIME.has(contentType)) {
        return json({ error: "UNSUPPORTED_MEDIA_TYPE" }, 415, cors);
      }

      if (contentType !== payload.contentType) {
        return json({ error: "CONTENT_TYPE_MISMATCH" }, 415, cors);
      }

      if (!request.body) {
        return json({ error: "EMPTY_BODY" }, 400, cors);
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
            return json({ error: "PAYLOAD_TOO_LARGE" }, 413, cors);
          }

          chunks.push(value);
        }
      } catch (err) {
        console.error("[upload-worker] Body read failed:", err);
        return json({ error: "BODY_READ_FAILED" }, 500, cors);
      }

      try {
        const body = new Blob(chunks, { type: contentType });

        await env.R2_BUCKET.put(payload.key, body, {
          httpMetadata: { contentType, cacheControl: CACHE_CONTROL },
        });
      } catch (err) {
        console.error("[upload-worker] R2 put failed:", err);
        return json({ error: "UPLOAD_FAILED" }, 500, cors);
      }

      return json({ ok: true }, 200, cors);
    } catch (err) {
      console.error("[upload-worker] Unhandled error:", err);
      return json({ error: "INTERNAL_ERROR" }, 500, { Vary: "Origin" });
    }
  },
} satisfies ExportedHandler<Env>;
