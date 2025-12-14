// components/RenderSections.tsx
import { Section } from "@/types/sections";
import Hero from "./sections/Hero";
import TwoColumn from "./sections/TwoColumn";
import Gallery from "./sections/Gallery";
import CTA from "./sections/CTA";

export function RenderSections({ sections }: { sections: Section[] }) {
  return (
    <>
      {sections.map((section, index) => {
        switch (section.type) {
          case "hero":
            return <Hero key={index} {...section} />;
          case "twoColumn":
            return <TwoColumn key={index} {...section} />;
          case "gallery":
            return <Gallery key={index} images={section.images} />;
          case "cta":
            return <CTA key={index} {...section} />;
          default:
            return null;
        }
      })}
    </>
  );
}
