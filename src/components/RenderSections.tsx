// components/RenderSections.tsx
import { PageSection } from "@/types/sections";
import Hero from "./sections/Hero";
import TwoColumn from "./sections/TwoColumn";
import Gallery from "./sections/Gallery";
import CTA from "./sections/CTA";
import Services from "./sections/Services";
import Banner from "./sections/Banner";
import Video from "./sections/Video";
import Contact from "./sections/Contact";
import CollectionIndex from "./sections/CollectionIndex";
import CollectionItem from "./sections/CollectionItem";

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

export default function RenderSections({ sections, pageSlug, entityContext }: Props) {
  const collectionRouteBase = resolveCollectionRouteBase(sections);
  return (
    <>
      {sections.map((section, index) => {
        const isEven = index % 2 === 0;

        const backgroundClass = isEven
          ? "bg-[var(--color-bg-primary)]"
          : "bg-[var(--color-bg-secondary)]";

        let content: React.ReactNode = null;

        switch (section.type) {
          case "hero":
            content = <Hero {...section} />;
            break;

          case "services":
            content = <Services {...section} />;
            break;

          case "banner":
            return <Banner key={index} {...section} />;

          case "gallery":
            content = <Gallery {...section} />;
            break;

          case "twoColumn":
            content = <TwoColumn {...section} />;
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
              <section key={index} className={backgroundClass}>
                <div className="mx-auto max-w-7xl px-6 py-20">
                  <CollectionIndex {...section} resolvedRouteBase={collectionRouteBase} />
                </div>
              </section>
            );

          case "collection-item":
            return (
              <section key={index} className={backgroundClass}>
                <div className="mx-auto max-w-7xl px-6 py-20">
                  <CollectionItem {...section} entityContext={entityContext} />
                </div>
              </section>
            );

          default:
            return null;
        }

        return (
          <section key={index} className={backgroundClass}>
            <div className="mx-auto max-w-7xl px-6 py-20">{content}</div>
          </section>
        );
      })}
    </>
  );
}
