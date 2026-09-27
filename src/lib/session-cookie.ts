/**
 * Name of the admin session cookie.
 *
 * Deliberately a single constant with no imports: the proxy reads it, and importing a module that
 * pulls in Prisma or an auth library would drag that weight into the proxy's bundle.
 *
 * The value still says `better-auth` on purpose. Live browsers hold this cookie, and renaming it
 * would sign everybody out for no functional gain — one line here is all it would take, and the only
 * cost is that everyone logs in again.
 */
export const SESSION_COOKIE = "better-auth.session_token";
