// components/RenderSections.tsx
import { PageSection } from "@/types/sections";
import Hero from "./sections/Hero";
import TwoColumn from "./sections/TwoColumn";
import Gallery from "./sections/Gallery";
import CTA from "./sections/CTA";
import Services from "./sections/Services";
import Banner from "./sections/Banner";

type Props = {
  sections: PageSection[];
};

export default function RenderSections({ sections }: Props) {
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

          case "cta":
            content = <CTA {...section} />;
            break;

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
