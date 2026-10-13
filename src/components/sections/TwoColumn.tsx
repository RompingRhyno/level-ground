import Image from "next/image";
import RichText from "@/components/RichText";
import Link from "next/link";
import { TwoColumnSection } from "@/types/sections";
import { serviceAnchorHref } from "@/lib/services";

/**
 * Two equal blocks side by side — one square image, one text block — inside a container capped at
 * 90vw / 1440px.
 *
 * The text block owns the square, but only from md up: `md:aspect-square` is a *preferred* size and a
 * grid item's automatic minimum size is content-based, so text wrapping to more lines grows the block
 * into a rectangle. The image drops its ratio at the same breakpoint (`md:aspect-auto`) and stretches to
 * the row height, so it always matches the text block exactly. Below md they stack: the image is the
 * square and the text block stays at its own content height, so short text leaves no dead space above
 * the next section. Keep the square off the image at md+ — an item with an aspect ratio will not stretch
 * past its ratio, so the image would stay square beside a taller text block and the pair would stop
 * matching.
 *
 * `textFirst` swaps which block leads at md+ only: false (default) puts the image first (left), true puts the
 * text block first. Below md they always stack as text over image, regardless of the flag.
 *
 * `sizes` carries the cover crop: the box is square but the stored photos are landscape, so `object-cover`
 * scales by height and the source needs `box × sourceAspect` px of width (×1.78 for a 16:9 photo, the
 * widest common case — under-declaring here is what makes the tile look soft next to the q95 full-span
 * images). Do not "fix" it down to the box width.
 *
 * All three text parts are optional and render only when present.
 */
export default function TwoColumn({
  title,
  titleHref,
  body,
  links,
  image,
  textFirst,
  serviceHrefs,
}: TwoColumnSection & { serviceHrefs?: Record<string, string> }) {
  const heading = title?.trim();
  const text = body?.trim();
  // A link resolves through its service reference when it has one; hrefs remain for anything that is
  // not a service. `serviceAnchorHref` is the pre-map fallback (the editor preview has no map).
  const resolved = (links ?? [])
    .map((link) => ({
      label: link.label ?? "",
      href: (link.service ? (serviceHrefs?.[link.service] ?? serviceAnchorHref(link.service)) : link.href) ?? "",
      key: `${link.label}-${link.service ?? link.href ?? ""}`,
    }))
    .filter((link) => link.label.trim() && link.href.trim());
  const items = resolved;

  const imageBlock = (
    <div className={`relative aspect-square overflow-hidden rounded-2xl shadow md:aspect-auto${textFirst ? "" : " md:order-1"}`}>
      {image ? (
        <Image
          src={image}
          alt={(title || "").replace(/<[^>]+>/g, "")}
          fill
          sizes="(min-width: 1600px) 1252px, (min-width: 768px) calc(80vw - 28px), 160vw"
          quality={95}
          className="object-cover"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 bg-(--color-bg-secondary)" />
      )}
    </div>
  );

  const textBlock = (
    <div className={`flex flex-col justify-center text-(--color-text-dark) md:aspect-square${textFirst ? "" : " md:order-2"}`}>
      {(heading || text || items.length > 0) && (
        <div className="space-y-4">
          {heading &&
            (titleHref ? (
              <Link href={titleHref} className="group block">
                <RichText
                  as="h2"
                  value={heading}
                  className="heading text-3xl md:text-5xl transition-colors group-hover:text-(--color-brand-primary)!"
                />
              </Link>
            ) : (
              <RichText as="h2" value={heading} className="heading text-3xl md:text-5xl" />
            ))}
          {text && <RichText value={text} />}
          {items.length > 0 && (
            <ul>
              {items.map((link) => (
                <li key={link.key}>
                  <Link
                    href={link.href}
                    className="font-bold block w-full border-b border-current pt-2 leading-[1.35] transition-colors hover:text-(--color-brand-primary)"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );

  return (
    <section>
      {/* Content blocks cap at 1440px; wider viewports earn a margin.
          DOM order is always text then image, so the stacked (below md) view is always text over image;
          which block leads at md+ comes from the order utilities on the blocks themselves. */}
      <div className="mx-auto w-[90vw] max-w-[1440px] grid grid-cols-1 gap-8 md:grid-cols-2">
        {textBlock}
        {imageBlock}
      </div>
    </section>
  );
}
