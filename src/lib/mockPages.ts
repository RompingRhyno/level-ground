// src/lib/mockPages.ts
import { PageSection } from "@/types/sections";

export type PageConfig = {
  slug: string;
  label: string;
  sections: PageSection[];
};

/* ------------------------------ Home Page ------------------------------ */
export const homePage: PageConfig = {
  slug: "home",
  label: "Home",
  sections: [
    {
      type: "hero",
      heading: "Your old <strong>residential landscaping</strong> experts",
      subheading: "Custom outdoor spaces built to last.",
      buttonText: "Get a Quote",
      buttonHref: "/contact",
      image: "/hero-placeholder.jpg",
    },
    {
      type: "services",
      heading: "Our <strong>services</strong>",
      services: [
        {
          title: "Design & Installation",
          image: "/services-installation.jpg",
          href: "/landscape-design-installation",
        },
        {
          title: "Maintenance",
          image: "/services-maintenance.jpg",
          href: "/landscape-maintenance",
        },
      ],
      bodyText:
        "From initial concept to long-term care, we provide full-service landscaping solutions tailored to your property.",
    },
    {
      type: "banner",
      heading: "Level Ground uses <strong>environmentally friendly</strong> products and techniques.",
      subheading: "",
      image: "/rain-barrel.jpeg",
      overlayOpacity: 0.45,
    },
  ],
};

/* ---------------------- Landscape Design & Installation ---------------------- */
export const installationPage: PageConfig = {
  slug: "landscape-design-installation",
  label: "Installation",
  sections: [
    {
      type: "hero",
      heading: "Landscape Design & Installation",
      subheading:
        "Custom, environmentally responsible outdoor spaces built to last.",
      buttonText: "Request a Consultation",
      buttonHref: "/contact",
      image: "/images/landscape-hero.jpg",
    },
    {
      type: "twoColumn",
      title: "Design Built for Your Property",
      body:
        "We create landscape designs that balance aesthetics, function, and long-term sustainability.",
      image: "/images/landscape-design.jpg",
    },
    {
      type: "twoColumn",
      title: "Professional Installation",
      body:
        "Our team ensures your landscape is installed correctly and efficiently, using environmentally friendly practices.",
      image: "/images/landscape-installation.jpg",
    },
    {
      type: "banner",
      heading:
        "Environmentally responsible landscaping is at the heart of everything we do.",
      subheading: "",
      image: "/images/eco-landscape.jpg",
      overlayOpacity: 0.35,
    },
  ],
};

/* ---------------------- Landscape Maintenance ---------------------- */
export const maintenancePage: PageConfig = {
  slug: "landscape-maintenance",
  label: "Maintenance",
  sections: [
    {
      type: "hero",
      heading: "Landscape Maintenance Services",
      subheading:
        "Keeping your outdoor spaces healthy, vibrant, and well-maintained.",
      buttonText: "Get a Free Estimate",
      buttonHref: "/contact",
      image: "/images/maintenance-hero.jpg",
    },
    {
      type: "banner",
      heading:
        "Sustainable maintenance practices for a healthier, greener landscape.",
      subheading: "",
      image: "/images/sustainable-maintenance.jpg",
      overlayOpacity: 0.3,
    },
  ],
 };
// export const hardscapingPage: PageConfig = { ... };

/* ---------------------- Optional: Aggregate all pages ---------------------- */
export const pages: PageConfig[] = [
  homePage,
  installationPage,
  maintenancePage,
  // add other pages here
];
