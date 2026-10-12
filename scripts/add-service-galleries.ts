/**
 * Insert one gallery section per service into the installation and maintenance pages.
 *
 * Each gallery is a curated five-image selection (assets carry no tags of their own, so the pool is
 * the folders tagged with that service's covers) with a heading and a short body. Copy is written for
 * the page rather than lifted from the old site — same facts, plainer and shorter.
 *
 * Sections go in before the page's closing banner, so the banner stays the last thing on the page.
 *
 * Dry run by default. Flags:
 *   --apply    write the sections
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { readFileSync } from "fs";
import { join } from "path";

const APPLY = process.argv.includes("--apply");

/** service slug -> [gallery heading, body copy] in canonical page order. */
const COPY: Record<string, [string, string]> = {
  "pavers-and-patios": [
    "Pavers & Patios",
    "Patios, walkways and driveways in interlocking pavers, concrete slabs, flagstone or granite. We prepare and compact the base, set grades away from the house, and detail the edges so the surface stays flat and tight.",
  ],
  planting: [
    "Planting",
    "Trees, shrubs, perennials and hedges chosen for your light, your soil and how much upkeep you want. We amend and mulch before planting \u2014 what happens under the surface decides how a garden looks in three years.",
  ],
  "lawn-installation": [
    "Lawn Installation",
    "New lawn in sod, or options that ask less of you: micro clover that stands up to chafer beetle and crowds out weeds, artificial turf for shaded or hard-to-mow areas, and putting greens if you want one.",
  ],
  "garden-beds-and-boxes": [
    "Garden Beds & Boxes",
    "Garden beds and raised boxes, built and filled with soil that will actually grow something. Useful where the ground is poor or the space is small \u2014 and for vegetables within reach of the kitchen.",
  ],
  "retaining-walls": [
    "Retaining Walls",
    "Engineered retaining walls in block and stack systems, built to hold soil where a slope or a change in grade needs it. Clean lines, with a raised bed or wall garden on top where the space allows.",
  ],
  "rock-and-gravel-features": [
    "Rock & Gravel Features",
    "River rock, basalt gravel and boulders for the parts of a yard that do not need planting \u2014 drainage runs, borders, dry creek beds, and ground cover that asks for no watering.",
  ],
  decking: [
    "Decking",
    "Cedar and composite decking for outdoor rooms that sit above grade: over a slope, off a door threshold, or somewhere you would rather not pave. Frame and finish built for how you will use it.",
  ],
  fencing: [
    "Fencing",
    "Cedar fencing for privacy, or aluminum for a clean line that lasts and asks nothing from you. Set plumb, with gates that keep closing properly.",
  ],
  "outdoor-lighting": [
    "Outdoor Lighting",
    "Low-voltage landscape lighting that carries a path, lights steps and the garage approach, and lets you use the yard after dark. Warm and low, placed to avoid glare.",
  ],
  irrigation: [
    "Irrigation",
    "Automatic irrigation and drip lines zoned to what you actually planted \u2014 lawn, beds, containers \u2014 on a schedule you can adjust. Water at the roots, not on the sidewalk.",
  ],
  "garden-maintenance": [
    "Garden Maintenance",
    "Scheduled garden care: cultivating and weeding, pruning and tree work, hedging, seasonal planting, and the leaf clearing November brings. Weekly, or as often as your garden needs.",
  ],
};

const INSTALLATION = ["pavers-and-patios","planting","lawn-installation","garden-beds-and-boxes","retaining-walls",
  "rock-and-gravel-features","decking","fencing","outdoor-lighting","irrigation"];

async function main() {
  const picks = JSON.parse(readFileSync("/tmp/picks.json", "utf8")) as Record<
    string,
    { id: string; folderName: string; filename: string }[]
  >;

  const makeGallery = (svc: string) => {
    const [heading, body] = COPY[svc];
    const ids = (picks[svc] ?? []).map((a) => a.id);
    if (ids.length !== 5) throw new Error(`${svc}: expected 5 picks, got ${ids.length}`);
    return { type: "gallery", mode: "static", layout: "bento", lightbox: true, heading, body, assetIds: ids };
  };

  const { default: prisma } = await import("../src/lib/prisma");

  const plan: { slug: string; galleries: any[] }[] = [
    { slug: "landscape-design-installation", galleries: INSTALLATION.map(makeGallery) },
    { slug: "landscape-maintenance", galleries: ["garden-maintenance"].map(makeGallery) },
  ];

  for (const { slug, galleries } of plan) {
    const page = await prisma.page.findUnique({ where: { slug }, select: { sections: true } });
    if (!page) throw new Error(`page not found: ${slug}`);
    const sections = (page.sections ?? []) as any[];
    if (sections.some((s) => s.type === "gallery")) {
      console.log(`${slug}: already has gallery section(s) — skipping to avoid duplicates`);
      continue;
    }
    // keep a trailing banner last
    const lastIsBanner = sections.at(-1)?.type === "banner";
    const head = lastIsBanner ? sections.slice(0, -1) : sections;
    const tail = lastIsBanner ? sections.slice(-1) : [];
    const next = [...head, ...galleries, ...tail];
    console.log(`\n${slug}: ${sections.length} sections -> ${next.length} (${galleries.length} galleries inserted${lastIsBanner ? " before the closing banner" : ""})`);
    for (const g of galleries) {
      console.log(`   + ${g.heading.padEnd(24)} ${g.assetIds.length} images  "${g.body.slice(0, 56)}…"`);
    }
    if (APPLY) {
      await prisma.page.update({ where: { slug }, data: { sections: next as any } });
      console.log(`   written`);
    }
  }

  if (!APPLY) console.log("\ndry run — re-run with --apply. Nothing was changed.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
