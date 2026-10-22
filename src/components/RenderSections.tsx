// components/RenderSections.tsx
import { PageSection, TwoColumnSection } from "@/types/sections";
import Hero from "./sections/Hero";
import TwoColumn from "./sections/TwoColumn";
import Gallery from "./sections/Gallery";
import CTA from "./sections/CTA";
import Services from "./sections/Services";
import Banner from "./sections/Banner";
import Testimonial from "./sections/Testimonial";
import Video from "./sections/Video";
import Contact from "./sections/Contact";
import CollectionIndex from "./sections/CollectionIndex";
import CollectionItem from "./sections/CollectionItem";
import ServiceLinks from "./sections/ServiceLinks";
import { getServiceHrefMap } from "@/lib/service-links";

type EntityContext = { entitySlug: string; source: "folders" | "tags" };

type Props = {
  sections: PageSection[];
  pageSlug: string;
  entityContext?: EntityContext;
  /** Opt-in, per page: paint every other section with the tint. Off by default. */
  alternate?: boolean;
};

function resolveCollectionRouteBase(sections: PageSection[]): string | undefined {
  const primary = sections.find(
    (s): s is PageSection & { type: "collection-index"; mode?: "primary" | "reference" } =>
      s.type === "collection-index" && ((s as any).mode ?? "primary") === "primary"
  );
  return (primary as any)?.routeBase || undefined;
}

export default async function RenderSections({ sections, pageSlug, entityContext, alternate = false }: Props) {
  const collectionRouteBase = resolveCollectionRouteBase(sections);
  // Resolved once per render for twoColumn service links: their displayed URL is derived from the
  // service's reference, so the editor can show a service name where the data holds one.
  const serviceHrefs = await getServiceHrefMap();
  return (
    <>
      {sections.map((section, index) => {
        // Alternating bands: the first section on band A, the second on band B, and so on. Full-bleed
        // sections (hero, banner) and the contact block still take a slot in that alternation — a
        // gallery / banner / gallery run reads A / B / A — they just have no visible band of their own.
        const parityClass = alternate
          ? index % 2 === 0
            ? "bg-[var(--color-bg-band-a)]"
            : "bg-[var(--color-bg-band-b)]"
          : "";
        // Published for components that have to paint a patch matching their section's surface (the
        // testimonial's tail mask). Unset on a plain page, so those fall back to the page colour.
        const surfaceVars = alternate
          ? ({ "--section-surface": index % 2 === 0 ? "var(--color-bg-band-a)" : "var(--color-bg-band-b)" } as React.CSSProperties)
          : undefined;

        // Where the tone boundary sits is decided by the padding split. Every inter-section gap is 48px
        // (the lower section's pt-12); with bands on, the two neighbours share it 24/24 so the colour
        // change lands halfway between their content instead of hard against the upper block. The total
        // never changes: a gap that touches a full-bleed section still comes entirely from the padded
        // side, except before a banner, which gives up its own padding to that neighbour.
        const BLEED = new Set(["hero", "banner", "contact"]);
        const typeAt = (i: number): string | null =>
          i >= 0 && i < sections.length ? (sections[i].type as string) : null;
        const padded = (t: string | null) => t !== null && !BLEED.has(t);
        const neighbourTop = (i: number) => !padded(typeAt(i - 1)) ? "pt-12" : "pt-6";
        const neighbourBottom = (i: number) => {
          const next = typeAt(i + 1);
          // Last section: the footer has no band of its own, so this side carries the whole gap —
          // otherwise the tone shift lands exactly on the content edge and the band looks cut off.
          if (next === null) return "pb-12";
          if (next === "banner") return "pb-12";
          if (!padded(next)) return "";
          return "pb-6";
        };
        const innerClass =
          typeAt(index) === "hero"
            ? "section-container"
            : BLEED.has(section.type as string)
              ? alternate
                ? "section-container"
                : "section-container pt-12"
              : alternate
                ? `section-container ${neighbourTop(index)} ${neighbourBottom(index)}`.trim()
                : "section-container pt-12";

        let content: React.ReactNode = null;

        switch (section.type) {
          case "hero":
            content = <Hero {...section} />;
            break;

          case "services":
            content = <Services {...section} />;
            break;

          case "banner":
            // Routed through the section wrapper like every other type. It used to return directly,
            // which left it with no vertical spacing of its own: the wrapper's padding is what separates
            // sections here, and a Banner's own padding is invisible because its image is
            // `absolute inset-0` and paints over the padding box.
            content = <Banner {...section} />;
            break;

          case "testimonial":
            content = <Testimonial {...section} />;
            break;

          case "gallery":
            content = <Gallery {...section} />;
            break;

          case "twoColumn":
            content = <TwoColumn {...(section as TwoColumnSection)} serviceHrefs={serviceHrefs} />;
            break;

          case "video":
            content = <Video {...section} />;
            break;

          case "contact":
            if (!section.id) throw new Error("Invalid contact section: missing id");
            return (
              <section key={index} className={parityClass} style={surfaceVars}>
                <Contact {...section} pageSlug={pageSlug} />
              </section>
            );

          case "cta":
            content = <CTA {...section} />;
            break;

          case "collection-index":
            return (
              <section key={index} className={parityClass} style={surfaceVars}>
                <div className={innerClass}>
                  <CollectionIndex {...section} resolvedRouteBase={collectionRouteBase} />
                </div>
              </section>
            );

          case "service-links":
            return (
              <section key={index} className={parityClass} style={surfaceVars}>
                <div className={innerClass}>
                  <ServiceLinks
                    sections={sections}
                    heading={(section as { heading?: string }).heading}
                  />
                </div>
              </section>
            );

          case "collection-item":
            return (
              <section key={index} className={parityClass} style={surfaceVars}>
                <div className={innerClass}>
                  <CollectionItem {...section} entityContext={entityContext} />
                </div>
              </section>
            );

          default:
            return null;
        }

        // The hero fills the viewport height (100svh minus the sticky header), so its wrapper must not add
        // vertical padding — that padding is what kept it from reaching the top of the screen.
        return (
          <section key={index} className={parityClass} style={surfaceVars}>
            <div className={innerClass}>
              {content}
            </div>
          </section>
        );
      })}
    </>
  );
}
