import Image from "next/image";
import Link from "next/link";

export type HeroProps = {
  heading: string;
  subheading?: string;
  buttonText: string;
  buttonHref: string;
  image: string;
  /**
   * Fill the viewport height (minus the sticky header). Must be off inside an auto-height iframe — the page
   * editor's preview is one — because `100svh` there resolves to the iframe's own height, which the iframe
   * derives from its content, so each pass grows the frame: the preview visibly creeps taller as you scroll.
   * A fixed height breaks the loop; the band still crops with object-cover either way.
   */
  fillViewport?: boolean;
};

// The sticky header (Navigation.tsx) is 67px: py-4 (32) + the 35px logo. `svh` (not `vh`) keeps the fill
// correct on mobile when the URL bar retracts.
const NAV_H = "67px";
const PREVIEW_H = "560px";

export default function Hero({
  heading,
  subheading,
  buttonText,
  buttonHref,
  image,
  fillViewport = true,
}: HeroProps) {
  const hasImage = Boolean(image);

  return (
    <section
      className="relative w-full flex items-center overflow-hidden min-h-[420px]"
      style={{ height: fillViewport ? `calc(100svh - ${NAV_H})` : PREVIEW_H }}
    >
      {/* Full-bleed image with the copy on top, so it needs a scrim: a gradient from the left keeps the
          text legible while the photo stays visible on the right. `object-cover object-center` is what
          makes a narrow (portrait) viewport crop the sides of a landscape photo and keep the middle,
          instead of squashing it or letterboxing it. Without an image the neutral panel shows and the
          text falls back to the normal heading colour.

          `sizes` follows the same rule the crop does: while the viewport is wider than 16:9 the width is
          what limits the scale, so 100vw is right; once it is taller than wide, object-cover scales by
          height, and the image needs roughly (height x 1.78) pixels of width — declaring only 100vw there
          would fetch a candidate that has to be upscaled. A fixed-height band is always width-limited. */}
      {hasImage ? (
        <>
          <Image
            src={image}
            alt=""
            fill
            priority
            sizes={
              fillViewport
                ? "(min-aspect-ratio: 16/9) 100vw, calc((100svh - 67px) * 1.78)"
                : "100vw"
            }
            quality={95}
            className="object-cover object-center"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to right, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.4) 45%, rgba(0,0,0,0.12) 100%)",
            }}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-(--color-bg-secondary)" />
      )}

      <div
        className="relative w-full px-4 md:px-8 py-16"
        style={{
          "--heading-color": hasImage
            ? "var(--color-text-inverse)"
            : "var(--color-text-heading)",
        } as React.CSSProperties}
      >
        <div className="max-w-2xl">
          <h1
            className="heading text-3xl md:text-5xl font-light tracking-tight"
            dangerouslySetInnerHTML={{ __html: heading }}
          />

          {subheading && (
            <p
              className="mt-4 text-base md:text-lg"
              style={{
                color: hasImage
                  ? "var(--color-text-inverse)"
                  : "var(--color-text-primary)",
                fontFamily: "var(--font-body)",
              }}
            >
              {subheading}
            </p>
          )}

          <div className="mt-8">
            <Link href={buttonHref} className="btn-primary">
              {buttonText}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
