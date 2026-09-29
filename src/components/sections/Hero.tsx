import Image from "next/image";
import Link from "next/link";

export type HeroProps = {
  heading: string;
  subheading?: string;
  buttonText: string;
  buttonHref: string;
  image: string;
  /**
   * Fill the viewport height (minus the sticky header) — what the real page does. Off inside the page
   * editor's section preview, which renders sections in an iframe whose height it measures from the
   * iframe's own content: a viewport-height hero is self-referential there and the frame creeps taller on
   * every scroll. In that mode the band instead takes its height from the image's own proportions at the
   * preview's width, so the preview shows the composition the photo actually has (portrait photos included)
   * rather than a fixed band that crops it.
   */
  fillViewport?: boolean;
};

// The sticky header (Navigation.tsx) is 67px: py-4 (32) + the 35px logo. `svh` (not `vh`) keeps the fill
// correct on mobile when the URL bar retracts.
const NAV_H = "67px";
// Placeholder box for the preview image before it loads (its real height follows from `h-auto`).
const PREVIEW_ATTR_W = 1600;
const PREVIEW_ATTR_H = 900;

export default function Hero({
  heading,
  subheading,
  buttonText,
  buttonHref,
  image,
  fillViewport = true,
}: HeroProps) {
  const hasImage = Boolean(image);

  const copy = (
    <div className="max-w-2xl">
      <h1
        className="heading text-3xl md:text-5xl font-light tracking-tight"
        dangerouslySetInnerHTML={{ __html: heading }}
      />

      {subheading && (
        <p
          className="mt-4 text-base md:text-lg"
          style={{
            color: hasImage ? "var(--color-text-inverse)" : "var(--color-text-primary)",
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
  );

  const headingColor = hasImage ? "var(--color-text-inverse)" : "var(--color-text-heading)";

  const scrim = (
    <div
      className="absolute inset-0"
      style={{
        background:
          "linear-gradient(to right, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.4) 45%, rgba(0,0,0,0.12) 100%)",
      }}
    />
  );

  // ── Editor preview ────────────────────────────────────────────────────────
  // The image sits in flow at the preview's width with `h-auto`, so the band's height is the image's own
  // proportions and nothing is cropped; a narrow portrait photo simply makes a taller band. The copy
  // overlays it. No viewport units anywhere, so the preview frame cannot feed itself.
  if (!fillViewport) {
    return (
      <section className="relative w-full">
        {hasImage ? (
          <>
            <Image
              src={image}
              alt=""
              width={PREVIEW_ATTR_W}
              height={PREVIEW_ATTR_H}
              sizes="100vw"
              quality={95}
              className="w-full h-auto"
            />
            {scrim}
          </>
        ) : (
          <div className="absolute inset-0 bg-(--color-bg-secondary)" />
        )}

        <div
          className="absolute inset-0 flex items-center px-4 md:px-8 py-16"
          style={{ "--heading-color": headingColor } as React.CSSProperties}
        >
          {copy}
        </div>
      </section>
    );
  }

  // ── Live page ─────────────────────────────────────────────────────────────
  // Full-bleed image covering the band, `object-cover object-center` so a narrower viewport crops the sides
  // of a landscape photo and keeps the middle instead of squashing or letterboxing it.
  //
  // `sizes` follows the same rule the crop does: while the viewport is wider than 16:9 the width is what
  // limits the scale, so 100vw is right; once it is taller than wide, object-cover scales by height and the
  // image needs roughly (height x 1.78) pixels of width — declaring only 100vw there would fetch a
  // candidate that has to be upscaled.
  return (
    <section
      className="relative w-full flex items-center overflow-hidden min-h-[420px]"
      style={{ height: `calc(100svh - ${NAV_H})` }}
    >
      {hasImage ? (
        <>
          <Image
            src={image}
            alt=""
            fill
            priority
            sizes="(min-aspect-ratio: 16/9) 100vw, calc((100svh - 67px) * 1.78)"
            quality={95}
            className="object-cover object-center"
          />
          {scrim}
        </>
      ) : (
        <div className="absolute inset-0 bg-(--color-bg-secondary)" />
      )}

      <div
        className="relative w-full px-4 md:px-8 py-16"
        style={{ "--heading-color": headingColor } as React.CSSProperties}
      >
        {copy}
      </div>
    </section>
  );
}
