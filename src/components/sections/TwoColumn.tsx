import Image from "next/image";
import Link from "next/link";
import { TwoColumnSection } from "@/types/sections";

/**
 * Two squares side by side — one image, one text block — inside a container capped at 9/16 of the
 * viewport (the remaining 7/16 is the margin, split evenly).
 *
 * The text block carries `aspect-square` as its *preferred* size; as a grid item its automatic minimum
 * size is content-based, so text that wraps to more lines grows it into a rectangle. The image block
 * drops its ratio at md+ and simply stretches to the row height, so it always matches the text block
 * exactly. Below md the two stack and each keeps its own square.
 *
 * `textFirst` swaps which block leads: false (default) puts the image first — left at md+, top when
 * stacked — true puts the text block first.
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
          sizes="(min-width: 768px) 28vw, 56vw"
          quality={90}
          className="object-cover"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 bg-(--color-bg-secondary)" />
      )}
    </div>
  );

  const textBlock = (
    <div className="aspect-square flex flex-col justify-center text-(--color-text-dark)">
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
