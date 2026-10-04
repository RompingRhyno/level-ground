import Image from "next/image";
import Link from "next/link";
import { TwoColumnSection } from "@/types/sections";

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
 * `textFirst` swaps which block leads: false (default) puts the image first — left at md+, top when
 * stacked — true puts the text block first.
 *
 * `sizes` carries the cover crop: the box is square but the stored photos are landscape, so `object-cover`
 * scales by height and the source needs `box × sourceAspect` px of width (×1.78 for a 16:9 photo, the
 * widest common case — under-declaring here is what makes the tile look soft next to the q95 full-span
 * images). Do not "fix" it down to the box width.
 *
 * All three text parts are optional and render only when present.
 */
export default function TwoColumn({ title, body, links, image, textFirst }: TwoColumnSection) {
  const heading = title?.trim();
  const text = body?.trim();
  const items = (links ?? []).filter((link) => link.label?.trim() && link.href?.trim());

  const imageBlock = (
    <div className="relative aspect-square overflow-hidden rounded-lg shadow md:aspect-auto">
      {image ? (
        <Image
          src={image}
          alt={title || ""}
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
    <div className="flex flex-col justify-center text-(--color-text-dark) md:aspect-square">
      {(heading || text || items.length > 0) && (
        <div className="space-y-4">
          {heading && <h2 className="text-3xl font-semibold">{heading}</h2>}
          {text && <p>{text}</p>}
          {items.length > 0 && (
            <ul>
              {items.map((link) => (
                <li key={`${link.label}-${link.href}`}>
                  <Link
                    href={link.href}
                    className="block w-full border-b border-current pt-2 leading-[1.35] transition-colors hover:text-(--color-text-light)"
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
      {/* Content blocks cap at 1440px; wider viewports earn a margin. */}
      <div className="mx-auto w-[90vw] max-w-[1440px] grid grid-cols-1 gap-8 md:grid-cols-2">
        {textFirst ? (
          <>
            {textBlock}
            {imageBlock}
          </>
        ) : (
          <>
            {imageBlock}
            {textBlock}
          </>
        )}
      </div>
    </section>
  );
}
