import SiteHeader from "@/components/SiteHeader";
import Footer, { FOOTER_DEFAULTS } from "@/components/sections/Footer";
import { getFooterConfig, getNavPages } from "@/lib/pages";
import { BUSINESS, SITE_URL, SUFFIX } from "@/lib/seo";
import type { FooterSection } from "@/types/sections";

/**
 * Structured data for every public page: the organization, its local-business identity (the NAP the
 * operator confirmed against the Google listing) and the site itself. One graph in the layout so
 * every route carries it; individual pages add nothing here.
 */
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: BUSINESS.name,
      url: SITE_URL,
      logo: `${SITE_URL}/logo-dark.png`,
      email: BUSINESS.email,
      telephone: BUSINESS.phone,
      sameAs: [BUSINESS.instagram],
    },
    {
      "@type": "LocalBusiness",
      "@id": `${SITE_URL}/#localbusiness`,
      name: BUSINESS.name,
      url: SITE_URL,
      image: `${SITE_URL}/logo-dark.png`,
      telephone: BUSINESS.phone,
      email: BUSINESS.email,
      address: {
        "@type": "PostalAddress",
        streetAddress: BUSINESS.street,
        addressLocality: BUSINESS.locality,
        addressRegion: BUSINESS.region,
        postalCode: BUSINESS.postalCode,
        addressCountry: BUSINESS.country,
      },
      areaServed: BUSINESS.areas.map((a) => ({ "@type": "Place", name: a })),
      openingHoursSpecification: BUSINESS.hours.map((h) => ({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: h.days,
        opens: h.opens,
        closes: h.closes,
      })),
      sameAs: [BUSINESS.instagram],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SUFFIX,
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
};

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [navPages, footerPage] = await Promise.all([getNavPages(), getFooterConfig()]);
  // A missing (or half-filled) footer row falls back to the last hard-coded copy, so deleting the
  // page in the admin cannot leave the site without a phone number or copyright line.
  const footer =
    footerPage?.sections.find((s): s is FooterSection => s.type === "footer") ?? FOOTER_DEFAULTS;

  return (
    <div className="min-h-dvh flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />
      <SiteHeader navPages={navPages.filter((p) => p.slug !== "home")} />
      <main className="flex-1 flex flex-col">{children}</main>
      <Footer {...footer} />
    </div>
  );
}
