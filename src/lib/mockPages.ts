// lib/mockPages.ts
import { Section } from "@/types/sections";

export const pages: Record<string, { sections: Section[] }> = {
  about: {
    sections: [
      {
        type: "hero",
        heading: "About Our Company",
        subheading: "Built on trust and craftsmanship",
        image: "/images/hero.jpg",
      },
      {
        type: "twoColumn",
        title: "What We Do",
        body: "We specialize in residential landscaping...",
        image: "/images/work.jpg",
      },
      {
        type: "gallery",
        images: [
          "/images/g1.jpg",
          "/images/g2.jpg",
          "/images/g3.jpg",
        ],
      },
      {
        type: "cta",
        text: "Ready to start your project?",
        buttonText: "Contact Us",
      },
    ],
  },
};
