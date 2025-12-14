// types/sections.ts
export type HeroSection = {
  type: "hero";
  heading: string;
  subheading?: string;
  image: string;
};

export type TwoColumnSection = {
  type: "twoColumn";
  title: string;
  body: string;
  image: string;
};

export type GallerySection = {
  type: "gallery";
  images: string[];
};

export type CTASection = {
  type: "cta";
  text: string;
  buttonText: string;
};

export type Section =
  | HeroSection
  | TwoColumnSection
  | GallerySection
  | CTASection;
