// types/sections.ts
export type PageConfig = {
  slug: string;
  label: string;
  sections: PageSection[];
};

export type HeroSection = {
  type: "hero";
  heading: string;
  subheading?: string;
  buttonText: string;
  buttonHref: string;
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

export type ServicesSection = {
  type: "services";
  heading: string;
  services: {
    title: string;
    image: string;
    href: string;
  }[];
  bodyText?: string;
};

export type BannerSection = {
  type: "banner";
  heading: string;
  subheading?: string;
  image?: string;
  overlayOpacity?: number; // e.g. 0.25 for 25%
};

export type PageSection =
  | HeroSection
  | ServicesSection
  | BannerSection
  | TwoColumnSection
  | GallerySection
  | CTASection;
