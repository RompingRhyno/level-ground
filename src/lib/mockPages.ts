import { PageSection } from "@/types/sections";

export const homePageSections: PageSection[] = [
  {
    type: "hero",
    heading: "Your <strong>residential landscaping</strong> experts",
    subheading: "Custom outdoor spaces built to last.",
    buttonText: "Get a Quote",
    buttonHref: "/contact",
    image: "/hero-placeholder.jpg",
  },
  {
    type: "services",
    heading: "Our <strong>Services</strong>",
    services: [
      {
        title: "Design & Installation",
        image: "/services-installation.jpg",
        href: "/services/installation",
      },
      {
        title: "Maintenance",
        image: "/services-maintenance.jpg",
        href: "/services/maintenance",
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
  }
];
