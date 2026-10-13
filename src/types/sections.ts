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
   * Optional anchor id, so other pages can deep-link to this gallery. Keep it stable: links elsewhere
   * point at it, and the section carries a scroll margin so the sticky header does not cover the top.
   *
   * When `service` is bound, the id derives from that reference and this field is ignored (the page
   * editor disables it) — it then only serves non-service sections that need a jump target.
   */
  anchor?: string;
  /**
   * The service this section *is* — a reference into the Service table, picked from the live list,
   * never typed. Cover-chip links resolve to wherever the bound section lives (any page), and a
   * service rename re-derives the id. See `docs/service-linking-plan.md`.
   */
  service?: string;
  /**
   * Collapse the gallery behind a button once it holds more than `seeMoreCutoff` photos. Off by
   * default; expanding renders the remainder into the same grid, so the layout pattern continues
   * without a seam (the visible cells are the full pattern's first N, not a pattern of their own).
   */
  seeMoreEnabled?: boolean;
  seeMoreText?: string;
  seeMoreCutoff?: number;
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
  /** Reference mode's link to the primary collection index; the button's text. */
  seeMoreText?: string;
  query?: {
    filter?: string;
  };
};

/**
 * Jump pills: one per service that has a section on the same page, each an in-page `#<slug>` anchor
 * — the same pill styling the collection index's filter row uses (see docs/service-linking-plan.md).
 * A service without a section here is left out: a pill that jumps nowhere reads as a bug.
 */
export type ServiceLinksSection = {
  type: "service-links";
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
  | CollectionItemSection
  | ServiceLinksSection;