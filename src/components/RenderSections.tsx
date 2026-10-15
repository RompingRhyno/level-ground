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
};

function resolveCollectionRouteBase(sections: PageSection[]): string | undefined {
  const primary = sections.find(
    (s): s is PageSection & { type: "collection-index"; mode?: "primary" | "reference" } =>
      s.type === "collection-index" && ((s as any).mode ?? "primary") === "primary"
  );
  return (primary as any)?.routeBase || undefined;
}

export default async function RenderSections({ sections, pageSlug, entityContext }: Props) {
  const collectionRouteBase = resolveCollectionRouteBase(sections);
  // Resolved once per render for twoColumn service links: their displayed URL is derived from the
  // service's reference, so the editor can show a service name where the data holds one.
  const serviceHrefs = await getServiceHrefMap();
  return (
    <>
      {sections.map((section, index) => {
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
            return <Contact key={index} {...section} pageSlug={pageSlug} />;

          case "cta":
            content = <CTA {...section} />;
            break;

          case "collection-index":
            return (
              <section key={index}>
                <div className="section-container pt-12">
                  <CollectionIndex {...section} resolvedRouteBase={collectionRouteBase} />
                </div>
              </section>
            );

          case "service-links":
            return (
              <section key={index}>
                <div className="section-container pt-12">
                  <ServiceLinks
                    sections={sections}
                    heading={(section as { heading?: string }).heading}
                  />
                </div>
              </section>
            );

          case "collection-item":
            return (
              <section key={index}>
                <div className="section-container pt-12">
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
          <section key={index}>
            <div className={section.type === "hero" ? "section-container" : "section-container pt-12"}>
              {content}
            </div>
          </section>
        );
      })}
    </>
  );
}
