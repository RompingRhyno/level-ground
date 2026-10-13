import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, unauthorized } from "@/lib/api-auth";
import { slugifyServiceName } from "@/lib/services-db";
import { getServiceLinkMap } from "@/lib/service-links";
import type { ServiceGroup } from "@/lib/services";

/**
 * The live service list with resolved links — public, the same way the public site renders it.
 * `href` is the resolver's answer (the bound section's location, or the group page when unbound),
 * so clients never build service URLs themselves.
 */
export async function GET() {
  const map = await getServiceLinkMap();
  return NextResponse.json(
    map.map(({ slug, name, group, href, hasSection }) => ({ slug, name, group, href, hasSection }))
  );
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

    // The create cascade: give the service a skeleton section on its group's page immediately, so
    // every cover-chip and lightbox link resolves the moment the service exists (see
    // docs/service-linking-plan.md, "A service is born incomplete").
    const pageSlug = group === "maintenance" ? "landscape-maintenance" : "landscape-design-installation";
    const page = await prisma.page.findUnique({ where: { slug: pageSlug }, select: { sections: true } });
    if (page) {
      const sections = [
        ...((page.sections ?? []) as unknown[]),
        {
          type: "gallery",
          mode: "static",
          layout: "bento",
          lightbox: true,
          heading: `<b>${created.name}</b>`,
          anchor: created.slug,
          service: created.slug,
          assetIds: [],
        },
      ];
      await prisma.page.update({ where: { slug: pageSlug }, data: { sections: sections as any } });
      revalidateTag(`page:${pageSlug}`, {});
    }

    revalidateTag("global:services", {});
    return NextResponse.json({ slug: created.slug, name: created.name, group: created.group });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
