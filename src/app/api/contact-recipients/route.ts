import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  const recipients = await prisma.contactRecipient.findMany({
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ recipients });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { email, name } = body as { email?: unknown; name?: unknown };

  if (typeof email !== "string" || !EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: "EMAIL_INVALID" }, { status: 400 });
  }

  let recipient;
  try {
    recipient = await prisma.contactRecipient.upsert({
      where: { email },
      update: { name: typeof name === "string" ? name : undefined },
      create: { email, name: typeof name === "string" ? name : null },
    });
  } catch (err) {
    console.error("[contact-recipients] upsert failed", err);
    return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, recipient });
}
