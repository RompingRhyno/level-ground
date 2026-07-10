// types/sections.ts
export type PageType = "page" | "template";

export type PageConfig = {
  slug: string;
  label: string;
  sections: PageSection[];
  type?: PageType;
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

export type GalleryLayout = "grid" | "bento" | "masonry";

export type GalleryFilters = {
  tags?: string[];
  folder?: string;
};

export type GallerySection = {
  type: "gallery";
  mode: "static" | "dynamic";
  layout?: GalleryLayout;
  lightbox?: boolean;
  heading?: string;
  body?: string;
} & (
  | { mode: "static"; assetIds: string[] }
  | { mode: "dynamic"; filters: GalleryFilters }
);

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

export type VideoSection = {
  type: "video";
  heading?: string;
  subheading?: string;
  videoUrl: string;
};

export type ContactFormFieldType = "text" | "email" | "tel" | "textarea";

export type ContactFormField = {
  id: string;
  label: string;
  type: ContactFormFieldType;
  required: boolean;
  placeholder?: string;
};

export type ContactSection = {
  type: "contact";
  id: string;
  heading: string;
  subheading?: string;
  image?: string;
  fields: ContactFormField[];
  servicesHeading?: string;
  serviceOptions?: string[];
  showUploader?: boolean;
  uploaderLabel?: string;
  submitLabel?: string;
  recipientIds: number[];
};

export type CollectionIndexSection = {
  type: "collection-index";
  source: "folders" | "tags";
  routeBase: string;
  detailTemplateSlug: string;
  heading?: string;
  entitySlugField?: string;
  cardComponent?: string;
  entityImages?: Record<string, string>;
  entityOrder?: string[];
  sortMode?: "custom" | "latest" | "earliest" | "alphabetical";
  query?: {
    filter?: string;
  };
};

export type CollectionItemSection = {
  type: "collection-item";
  source?: "folders" | "tags";
  layout?: GalleryLayout;
  lightbox?: boolean;
};

export type PageSection =
  | HeroSection
  | ServicesSection
  | BannerSection
  | TwoColumnSection
  | GallerySection
  | CTASection
  | VideoSection
  | ContactSection
  | CollectionIndexSection
  | CollectionItemSection;
