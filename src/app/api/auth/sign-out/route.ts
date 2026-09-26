import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE } from "@/lib/auth";

/**
 * Sign-out, deliberately shadowing better-auth's endpoint of the same name.
 *
 * Sessions here are rows in the `session` table, validated by `getSession()` — better-auth knows
 * nothing about them. Its handler cleared the cookies and answered `{"success": true}` while leaving
 * the row alive, so a captured token stayed valid after "signing out". This deletes the row first,
 * then clears the cookie with the same options the sign-in route used.
 *
 * A static segment takes precedence over the `[...all]` catch-all, so better-auth's version never
 * runs. The user is signed out even if the row is already gone (idempotent).
 */
export async function POST() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
  });
  return response;
}
