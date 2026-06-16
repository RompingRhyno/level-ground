import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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
  const { pageSlug, sectionId } = raw;

  if (typeof pageSlug !== "string" || !pageSlug) {
    return NextResponse.json({ error: "INVALID_PAGE_SLUG" }, { status: 400 });
  }
  if (typeof sectionId !== "string" || !sectionId) {
    return NextResponse.json({ error: "INVALID_SECTION_ID" }, { status: 400 });
  }

  let page: { sections: unknown } | null;
  try {
    page = await prisma.page.findUnique({ where: { slug: pageSlug } });
  } catch {
    return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  }

  if (!page) {
    return NextResponse.json({ error: "PAGE_NOT_FOUND" }, { status: 404 });
  }

  if (!Array.isArray(page.sections)) {
    return NextResponse.json({ error: "CMS_INVALID" }, { status: 400 });
  }

  const section = (page.sections as Record<string, unknown>[]).find(
    (s) => s.id === sectionId,
  );

  if (!section) {
    return NextResponse.json({ error: "SECTION_NOT_FOUND" }, { status: 404 });
  }

  if (section.type !== "contact" || !section.showUploader) {
    return NextResponse.json({ error: "SECTION_NOT_UPLOAD_ENABLED" }, { status: 400 });
  }

  const sessionId = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);

  try {
    await prisma.contactUploadSession.create({
      data: { id: sessionId, sectionId, expiresAt },
    });
  } catch {
    return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  }

  return NextResponse.json({ sessionId, maxFiles: 5 });
}
