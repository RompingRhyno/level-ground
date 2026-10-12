import Image from "next/image";
import Link from "next/link";
import type { HeroHeight } from "@/types/sections";

export type HeroProps = {
  heading: string;
  subheading?: string;
  buttonText: string;
  buttonHref: string;
  image: string;
  /** Optional transparent artwork over the full-span photo, above the heading. */
  overlayImage?: string;
  /**
   * Fill the viewport height (minus the sticky header) — what the real page does. Off inside the page
   * editor's section preview, which renders sections in an iframe whose height it measures from the
   * iframe's own content: a viewport-height hero is self-referential there and the frame creeps taller on
   * every scroll. In that mode the band instead takes its height from the image's own proportions at the
   * preview's width, so the preview shows the composition the photo actually has (portrait photos included)
   * rather than a fixed band that crops it.
   */
  fillViewport?: boolean;
  /** Band height as a fraction of the viewport (minus the sticky header). Defaults to "full". */
  height?: HeroHeight;
};

// Band heights, in small-viewport units. `full` is the original behaviour; the shorter ones trade photo
// height for what sits above the fold, while the 420px floor on the section keeps the copy from
// overflowing on short screens.
const HEIGHT_SVH: Record<HeroHeight, number> = { full: 100, tall: 88, medium: 72, short: 56 };

// The sticky header (Navigation.tsx) is 67px: py-4 (32) + the 35px logo. `svh` (not `vh`) keeps the fill
// correct on mobile when the URL bar retracts.
const NAV_H = "67px";
// Placeholder box for the preview image before it loads (its real height follows from `h-auto`).
const PREVIEW_ATTR_W = 1600;
const PREVIEW_ATTR_H = 900;

// Shared by both render paths: the band is a two-row grid, the copy lands in the lower portion so it reads
// as a base rather than a centred block, and its own row placement lives on the copy element itself.
// 5fr/4fr puts the copy's top edge at ~55.6% of the band — twice raised from the original 66.7% (then 60%)
// because the operator kept finding it too low.
const BAND_GRID = "grid grid-rows-[5fr_4fr]";
const COPY_PLACEMENT = "col-start-1 row-start-2";

export default function Hero({
  heading,
  subheading,
  buttonText,
  buttonHref,
  image,
  overlayImage,
  fillViewport = true,
  height = "full",
}: HeroProps) {
  const hasImage = Boolean(image);
  const svh = HEIGHT_SVH[height] ?? HEIGHT_SVH.full;
  // The pill renders only when it has both a label and a destination — an unset link (the editor's
  // "none") would otherwise leave an empty pill, and a label alone a dead one.
  const buttonLabel = buttonText?.trim();
  const buttonLink = buttonHref?.trim();
  // An unset (or markup-only) heading must not render: the h1's line box at this size is a visible gap.
  const headingHtml = heading?.trim();
  const hasHeading = Boolean(
    headingHtml?.replace(/<[^>]*>/g, "").replace(/&nbsp;|\u00a0/g, "").trim()
  );

  // No scrim over the whole photo, but a bottom-anchored gradient: it grounds the copy where it now sits
  // (the lower half) and leaves the upper part of the image untouched. The copy's own text shadow
  // (`.hero-text-shadow`, applied only when there is an image) still does the letter-edge definition.
  // Strengths nudged up slightly (0.6/0.35 → 0.65/0.4) at the operator's request; the 70% fade point is
  // unchanged, so it is a touch deeper rather than taller.
  const scrim = (
    <div
      className="absolute inset-0"
      style={{
        background:
          "linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.4) 35%, rgba(0,0,0,0) 70%)",
      }}
    />
  );

  const copy = (
    <div
      className={`relative ${COPY_PLACEMENT} w-full px-4 md:px-8 pt-6 pb-10 max-w-[80vw] mx-auto text-center${
        hasImage ? " hero-text-shadow" : ""
      }`}
    >
      {/* Optional transparent artwork (a mark or badge) sitting over the photo, above the heading.
          The box is fixed-height with `object-contain`, so no aspect ratio is needed and the mark cannot
          be stretched. `sizes` is a plain list (not `auto`: unsupported builds fall back to 100vw and
          fetch the largest candidate) sized for a wide wordmark at the box's max width. */}
      {overlayImage && (
        <Image
          src={overlayImage}
          alt=""
          width={0}
          height={0}
          priority
          sizes="(min-width: 768px) 768px, 512px"
          quality={95}
          className="mx-auto mb-4 md:mb-6 h-12 md:h-16 w-full max-w-[42rem] object-contain"
        />
      )}

      {hasHeading && (
        <h1
          className="heading text-5xl sm:text-6xl md:text-7xl font-light tracking-tight"
          dangerouslySetInnerHTML={{ __html: headingHtml as string }}
        />
      )}

      {subheading && (
        <p
          className="mt-4 text-xl md:text-3xl"
          style={{
            color: hasImage ? "var(--color-text-inverse)" : "var(--color-text-primary)",
            fontFamily: "var(--font-body)",
          }}
        >
          {subheading}
        </p>
      )}

      {buttonLabel && buttonLink && (
        <div className="mt-8">
          <Link
            href={buttonLink}
            className="btn-primary text-lg! md:text-[26px]! font-bold! [text-shadow:none]"
          >
            {buttonLabel}
          </Link>
        </div>
      )}
    </div>
  );

  const headingColor = hasImage ? "var(--color-text-inverse)" : "var(--color-text-heading)";

  // ── Editor preview ────────────────────────────────────────────────────────
  // The image sits in flow at the preview's width with `h-auto`, so the band's height is the image's own
  // proportions and nothing is cropped; a narrow portrait photo simply makes a taller band. The copy
  // overlays it. No viewport units anywhere, so the preview frame cannot feed itself.
  if (!fillViewport) {
    return (
      <section className="relative w-full">
        {hasImage ? (
          <Image
            src={image}
            alt=""
            width={PREVIEW_ATTR_W}
            height={PREVIEW_ATTR_H}
            sizes="100vw"
            quality={95}
            className="w-full h-auto"
          />
        ) : (
          <div className="absolute inset-0 bg-(--color-bg-secondary)" />
        )}

        <div
          className={`absolute inset-0 ${BAND_GRID}`}
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
      className={`relative w-full ${BAND_GRID} overflow-hidden min-h-[420px]`}
      style={
        { height: `calc(${svh}svh - ${NAV_H})`, "--heading-color": headingColor } as React.CSSProperties
      }
    >
      {hasImage ? (
        <>
          <Image
            src={image}
            alt=""
            fill
            priority
            sizes={`(min-aspect-ratio: 16/9) 100vw, calc((${svh}svh - 67px) * 1.78)`}
            quality={95}
            className="object-cover object-center"
          />
          {scrim}
        </>
      ) : (
        <div className="absolute inset-0 bg-(--color-bg-secondary)" />
      )}

      {copy}
    </section>
  );
}
