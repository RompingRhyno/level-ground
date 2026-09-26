import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession, unauthorized } from "@/lib/api-auth";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX_LENGTH = 254;

export async function GET() {
  const session = await requireSession();
  if (!session) return unauthorized();

  const recipients = await prisma.contactRecipient.findMany({
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ recipients });
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

  const body = await request.json();
  const { email, name } = body as { email?: unknown; name?: unknown };

  const trimmedEmail =
    typeof email === "string" ? email.trim() : "";

  if (
    !trimmedEmail ||
    trimmedEmail.length > EMAIL_MAX_LENGTH ||
    trimmedEmail.includes("\r") ||
    trimmedEmail.includes("\n") ||
    !EMAIL_REGEX.test(trimmedEmail)
  ) {
    return NextResponse.json({ error: "EMAIL_INVALID" }, { status: 400 });
  }

  let recipient;
  try {
    recipient = await prisma.contactRecipient.upsert({
      where: { email: trimmedEmail },
      update: { name: typeof name === "string" ? name : undefined },
      create: {
        email: trimmedEmail,
        name: typeof name === "string" ? name : null,
      },
    });
  } catch (err) {
    console.error("[contact-recipients] upsert failed", err);
    return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, recipient });
}