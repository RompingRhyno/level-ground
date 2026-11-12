import type { FooterSection } from "@/types/sections";

/**
 * The footer the layout renders on every page. Its copy is stored as a `footer` section on the
 * `footer` Page row, so the operator edits it in the page editor like any other section — this
 * component only renders it.
 */
export const FOOTER_DEFAULTS: FooterSection = {
  type: "footer",
  phone: "778-223-5005",
  serviceAreas: "Vancouver, West Vancouver, Burnaby, and Richmond, BC",
  businessName: "Level Ground Landscaping",
};

/** `tel:` for a displayed number: keep a leading +, otherwise assume a North American 10-digit form. */
function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return `tel:${digits}`;
  return digits.length === 10 ? `tel:+1${digits}` : `tel:${digits}`;
}

export default function Footer({ phone, serviceAreas, businessName }: FooterSection) {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-(--color-bg-primary) px-6 py-4">
      <div className="space-y-1">
        {phone ? (
          <p className="font-bold">
            <a href={telHref(phone)} className="hover:underline">
              {phone}
            </a>
          </p>
        ) : null}
        {serviceAreas ? (
          <p>
            <strong>Serviced Areas:</strong> {serviceAreas}
          </p>
        ) : null}
        {businessName ? <p>© {year} {businessName}</p> : null}
      </div>
    </footer>
  );
}
