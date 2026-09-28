import Image from "next/image";
import Link from "next/link";

export type HeroProps = {
  heading: string;
  subheading?: string;
  buttonText: string;
  buttonHref: string;
  image: string;
};

export default function Hero({
  heading,
  subheading,
  buttonText,
  buttonHref,
  image,
}: HeroProps) {
  const hasImage = Boolean(image);

  return (
    <section className="relative w-full min-h-[420px] md:min-h-[560px] flex items-center overflow-hidden">
      {/* Full-bleed image with the copy on top, so it needs a scrim: a gradient from the left keeps the
          text legible while the photo stays visible on the right. Without an image the neutral panel
          shows and the text falls back to the normal heading colour. */}
      {hasImage ? (
        <>
          <Image
            src={image}
            alt=""
            fill
            priority
            sizes="100vw"
            quality={95}
            className="object-cover"
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
