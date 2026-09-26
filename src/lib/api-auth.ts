import { NextResponse } from "next/server";
import { getSession } from "./session";

/**
 * Session guard for API routes.
 *
 * `src/proxy.ts` only checks that a session cookie is *present* — it cannot validate it, and it
 * does not run for internal calls. Every admin-facing route must therefore verify the session
 * itself, or a forged cookie value (`better-auth.session_token=anything`) would be enough to read
 * and mutate the media library and pages.
 *
 * Public endpoints (contact form submission, contact upload sessions, auth endpoints, the contact
 * cleanup cron) deliberately do not use this.
 */
export type ApiSession = Awaited<ReturnType<typeof getSession>>;

export async function requireSession(): Promise<NonNullable<ApiSession> | null> {
  const session = await getSession();
  return session ?? null;
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
