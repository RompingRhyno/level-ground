import SiteHeader from "@/components/SiteHeader";
import { getNavPages } from "@/lib/pages";
import { BUSINESS, SITE_URL, SUFFIX } from "@/lib/seo";

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
  const navPages = (await getNavPages()).filter((p) => p.slug !== "home");

  return (
    <div className="min-h-dvh flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />
      <SiteHeader navPages={navPages} />
      <main className="flex-1 flex flex-col">{children}</main>
      <footer className="bg-(--color-bg-primary) px-6 py-4">
        © {new Date().getFullYear()} Level Ground Landscaping
      </footer>
    </div>
  );
}
