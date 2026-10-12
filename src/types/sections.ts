// types/sections.ts
export type PageType = "page" | "template";

export type PageConfig = {
  slug: string;
  label: string;
  sections: PageSection[];
  type?: PageType;
  /** Render this page's sticky-header nav entry as a pill button rather than an underlined link. */
  navPill?: boolean;
  /** Show the floating "jump to top" button on this page's public view. */
  jumpToTop?: boolean;
  /** SEO title, used verbatim (no suffix added). Seeded from the legacy site's titles. */
  metaTitle?: string | null;
  /** SEO description; falls back to the hero subheading when unset. */
  metaDescription?: string | null;
};

/** Band height as a fraction of the viewport (minus the sticky header). */
export type HeroHeight = "full" | "tall" | "medium" | "short";

export type HeroSection = {
  type: "hero";
  heading: string;
  subheading?: string;
  buttonText: string;
  buttonHref: string;
  /** Defaults to "full" when absent. */
  height?: HeroHeight;
  image: string;
  /**
   * Optional transparent image (PNG/WebP) drawn over the full-span photo, above the heading — a mark
   * or badge that needs the artwork's own transparency, which a background photo cannot carry.
   */
  overlayImage?: string;
};

export type TwoColumnLink = {
  label: string;
  href: string;
};

export type TwoColumnSection = {
  type: "twoColumn";
  title: string;
  /** Optional link for the heading itself — e.g. a service list heading pointing at its service page. */
  titleHref?: string;
  body: string;
  links?: TwoColumnLink[];
  image: string;
  /** false (default) = image first, text second; true = text first, image second. */
  textFirst?: boolean;
};

export type GalleryLayout = "grid" | "bento" | "masonry";

export type GalleryFilters = {
  tags?: string[];
  folder?: string;
};

export type GalleryTagDisplay = {
  enabled: boolean;
  mode: "auto" | "manual";
  tags?: string[];
};

export type GallerySection = {
  type: "gallery";
  mode: "static" | "dynamic";
  layout?: GalleryLayout;
  lightbox?: boolean;
  heading?: string;
  body?: string;
  /**
   * Optional anchor id, so other pages can deep-link to this gallery (e.g. the home page's two-column
   * service lists link to `/landscape-design-installation#planting`). Keep it stable: links elsewhere
   * point at it, and the section carries a scroll margin so the sticky header does not cover the top.
   */
  anchor?: string;
  tagDisplay?: GalleryTagDisplay;
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
  mode?: "primary" | "reference";
  source: "folders" | "tags";
  routeBase: string;
  detailTemplateSlug: string;
  heading?: string;
  entitySlugField?: string;
  cardComponent?: string;
  entityImages?: Record<string, string>;
  entityOrder?: string[];
  sortMode?: "custom" | "latest" | "earliest" | "alphabetical";
  showTagFilter?: boolean;
  maxItems?: number;
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