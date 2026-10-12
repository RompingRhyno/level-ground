import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, unauthorized } from "@/lib/api-auth";
import { slugifyServiceName } from "@/lib/services-db";
import type { ServiceGroup } from "@/lib/services";

/** The live service list — public, the same way the public site renders it. */
export async function GET() {
  const rows = await prisma.service.findMany({ orderBy: [{ order: "asc" }, { id: "asc" }] });
  return NextResponse.json(rows.map((row) => ({ slug: row.slug, name: row.name, group: row.group })));
}

/** Create a service. Always one of the two groups — they map to the two service pages. */
export async function POST(request: NextRequest) {
  const session = await requireSession();
  if (!session) return unauthorized();

  try {
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const group: ServiceGroup = body?.group === "maintenance" ? "maintenance" : "installation";
    if (!name) return NextResponse.json({ error: "missing name" }, { status: 400 });

    const slug = slugifyServiceName(name);
    if (!slug) return NextResponse.json({ error: "name produces an empty slug" }, { status: 400 });

    const existing = await prisma.service.findUnique({ where: { slug } });
    if (existing) return NextResponse.json({ error: "that service already exists" }, { status: 409 });

    const maxOrder = await prisma.service.aggregate({ _max: { order: true } });
    const created = await prisma.service.create({
      data: { slug, name, group, order: (maxOrder._max.order ?? 0) + 1 },
    });

    revalidateTag("global:services", {});
    return NextResponse.json({ slug: created.slug, name: created.name, group: created.group });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
