import RichText from "@/components/RichText";

/**
 * The heading + body pair that sits above a gallery (and, in the admin preview, above any section that
 * carries them). Shared so the public page and the preview can never drift apart again — the preview
 * previously kept its own copy and rendered the body as plain text, showing raw `<br>`/`<strong>`.
 */
export default function SectionHeader({
  heading,
  body,
}: {
  heading?: string;
  body?: string;
}) {
  if (!heading && !body) return null;
  return (
    <div className="w-full px-4 md:px-8 mb-8">
      <RichText
        as="h2"
        value={heading}
        className="heading max-w-4xl text-3xl sm:text-3xl md:text-5xl font-light leading-tight mb-6"
        style={{ color: "var(--color-text-heading)" }}
      />

      <RichText
        value={body}
        className="mt-4 max-w-3xl text-left"
        style={{ color: "var(--color-text-primary)" }}
      />
    </div>
  );
}
