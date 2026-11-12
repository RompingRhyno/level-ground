import type { FooterSection } from "@/types/sections";

/**
 * The footer the layout renders on every page. Its copy is stored as a `footer` section on the
 * `footer` Page row, so the operator edits it in the page editor like any other section — this
 * component only renders it.
 */
export const FOOTER_DEFAULTS: FooterSection = {
  type: "footer",
  phone: "778-223-5005",
  details: "<strong>Serviced Areas:</strong> Vancouver, West Vancouver, Burnaby, and Richmond, BC",
  businessName: "Level Ground Landscaping",
};

/** `tel:` for a displayed number: keep a leading +, otherwise assume a North American 10-digit form. */
function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return `tel:${digits}`;
  return digits.length === 10 ? `tel:+1${digits}` : `tel:${digits}`;
}

export default function Footer({ phone, details, serviceAreas, businessName }: FooterSection) {
  const year = new Date().getFullYear();
  return (
    <footer
      className="bg-(--color-bg-primary) px-6 pb-4"
      // One extra line of breathing room above the first line; the bottom keeps its original padding.
      style={{ paddingTop: "calc(1rem + 1lh)" }}
    >
      {/* One blank line between the blocks — 1lh is exactly the line box a blank line occupies in
          the rich details field, so the visual rhythm matches what the editor shows. */}
      <div className="flex flex-col gap-[1lh]">
        {details ? (
          // Rich text from the editor: bold, italic, links. Same trust model as the hero subheading.
          <div dangerouslySetInnerHTML={{ __html: details }} />
        ) : serviceAreas ? (
          <p>
            <strong>Serviced Areas:</strong> {serviceAreas}
          </p>
        ) : null}
        {phone ? (
          <p className="font-bold">
            <a href={telHref(phone)} className="hover:underline">
              {phone}
            </a>
          </p>
        ) : null}
        {businessName ? <p>© {year} {businessName}</p> : null}
      </div>
    </footer>
  );
}
