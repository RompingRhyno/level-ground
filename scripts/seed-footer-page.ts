/**
 * Creates the `footer` Page row (idempotent).
 *
 * The footer is edited in the page editor but is never a route, a nav entry or a sitemap URL: the
 * site layout renders its `footer` section on every page. Run once per database:
 *
 *   npx tsx --env-file=.env --env-file=.env.local scripts/seed-footer-page.ts
 *
 * Existing rows are left untouched, so re-running never overwrites operator edits.
 */
import prisma from "../src/lib/prisma";

const FOOTER_SECTION = {
  type: "footer",
  phone: "778-223-5005",
  details: "<strong>Serviced Areas:</strong> Vancouver, West Vancouver, Burnaby, and Richmond, BC",
  businessName: "Level Ground Landscaping",
};

async function main() {
  const existing = await prisma.page.findUnique({ where: { slug: "footer" } });
  if (existing) {
    // Migrate the earlier plain `serviceAreas` field to the rich `details` field, once.
    const sections = (existing.sections as any[]) ?? [];
    const section = sections.find((s) => s?.type === "footer");
    if (section && !section.details && typeof section.serviceAreas === "string") {
      section.details = `<strong>Serviced Areas:</strong> ${section.serviceAreas}`;
      delete section.serviceAreas;
      await prisma.page.update({ where: { slug: "footer" }, data: { sections } });
      console.log("migrated serviceAreas → details");
    } else {
      console.log(`footer page already exists (type=${existing.type})`);
    }
    return;
  }

  const max = await prisma.page.aggregate({ _max: { order: true } });
  const row = await prisma.page.create({
    data: {
      slug: "footer",
      label: "Footer",
      type: "footer",
      // After every navigable page, so the admin list reads in nav order.
      order: (max._max.order ?? 0) + 1,
      sections: [FOOTER_SECTION],
    },
  });
  console.log(`created footer page: slug=${row.slug} type=${row.type} order=${row.order}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
