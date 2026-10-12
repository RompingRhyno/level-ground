/**
 * Second pass over the service descriptions: fresh copy, written independently of the previous
 * version and of the old site's own sentences. Facts (the covers) stay; phrasing is new.
 *
 * The eleven gallery bodies are replaced in canonical order; Lawn maintenance gains its section
 * (heading + description, no images yet — no project carries the service).
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

const INSTALL: [string, string][] = [
  [
    "Pavers & Patios",
    "Hardscaping that holds its shape: patios, walkways and driveways laid in pavers, slabs, flagstone or granite. Grades and drainage are set first, so a rain-soaked winter does not shift what we build.",
  ],
  [
    "Planting",
    "Trees, shrubs, perennials and hedges picked to suit how much sun and attention your garden gets. Soil comes first \u2014 amended and mulched \u2014 because a plant is only as good as the ground it starts in.",
  ],
  [
    "Lawn installation",
    "Sod when you want grass now, micro clover when you want less mowing and a lawn that resists chafer beetle, artificial turf where shade or drainage fights real grass \u2014 and a putting green if the yard is calling for one.",
  ],
  [
    "Garden beds & boxes",
    "Raised beds and garden boxes that make growing easy \u2014 good soil above poor ground, vegetables at a comfortable height, and less bending for the things you pick most.",
  ],
  [
    "Retaining walls",
    "Where a yard changes level, a wall should look deliberate and hold for decades. We build engineered block and stack walls to manage the grade, and leave room above for planting when the site allows.",
  ],
  [
    "Rock & gravel features",
    "Rock does the work where plants struggle: river rock and basalt gravel for drainage and dry creek beds, boulders for structure \u2014 a surface that needs no water and very little of your time.",
  ],
  [
    "Decking",
    "For living space that floats above the ground \u2014 over a slope, or stepping out from a door \u2014 cedar and composite decking built on a frame sized and finished for how you will actually use it.",
  ],
  [
    "Fencing",
    "Privacy from neighbours, or a boundary that simply disappears into the landscape. Cedar fences built to last, aluminum where you would rather never think about it again \u2014 gates included.",
  ],
  [
    "Outdoor Lighting",
    "After sunset, a yard should still be usable and a driveway should still feel safe. Low-voltage lighting along paths, steps and the approach, kept warm and out of your eyeline.",
  ],
  [
    "Irrigation",
    "The garden gets the schedule, not the other way around. Automatic irrigation and drip lines set zone by zone \u2014 lawn, beds, containers \u2014 so watering lands on roots and not the walkway.",
  ],
];

const MAINTENANCE: [string, string][] = [
  [
    "Lawn maintenance",
    "A healthy lawn is a routine, not a rescue. Mowing, aeration, fertilization, moss control and overseeding on a schedule, so the lawn gets what it needs before it starts to show signs it missed it.",
  ],
  [
    "Garden maintenance",
    "A garden looks its best when it is visited on a rhythm, not after it has overgrown. Weeding and cultivation, pruning and hedging, seasonal planting, and the fall leaf rounds \u2014 on a schedule that fits the garden.",
  ],
];

async function main() {
  const { default: prisma } = await import("../src/lib/prisma");

  const set = async (slug: string, copy: [string, string][]) => {
    const page = await prisma.page.findUnique({ where: { slug }, select: { sections: true } });
    if (!page) throw new Error(`page not found: ${slug}`);
    const sections = (page.sections ?? []) as any[];

    let idx = 0;
    for (const s of sections) {
      if (s.type !== "gallery" || s.mode !== "static") continue;
      const [heading, body] = copy[idx] ?? [];
      if (!heading) break;
      const note = s.body === body ? " (unchanged)" : "";
      if (s.body !== body) console.log(`BODY ${slug}: "${(s.heading as string).padEnd(20)}" updated${note}`);
      s.heading = heading;
      s.body = body;
      idx++;
    }
    const applied = idx;
    console.log(`\n${slug}: ${applied}/${copy.length} descriptions written`);

    // Sections the page did not have yet (Lawn maintenance): insert before the first existing
    // service gallery, i.e. right after the hero area.
    const missing = copy.slice(idx);
    if (missing.length) {
      const firstGallery = sections.findIndex((s) => s.type === "gallery");
      const insertAt = firstGallery === -1 ? sections.length - 1 : firstGallery;
      for (const [heading, body] of missing) {
        console.log(`INSERT ${slug}: new section "${heading}" at ${insertAt}`);
        sections.splice(insertAt, 0, {
          type: "gallery",
          mode: "static",
          layout: "bento",
          lightbox: false,
          heading,
          body,
          assetIds: [],
        });
      }
    }
    await prisma.page.update({ where: { slug }, data: { sections } });
  };

  await set("landscape-design-installation", INSTALL);
  await set("landscape-maintenance", MAINTENANCE);
  await prisma.$disconnect();
  console.log("\nDONE");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
