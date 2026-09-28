// components/sections/Banner.tsx
import Image from "next/image";
import { BannerSection } from "@/types/sections";

export default function Banner({
  heading,
  subheading,
  image,
  overlayOpacity = 0.25,
}: BannerSection) {
  const hasImage = Boolean(image);

  return (
    <section className="relative py-24 px-4 sm:px-6">
      {/* Background image and overlay. Full-span media takes the q95 tier. No `priority`: the banner sits
          below the fold on every page it appears on, so preloading it competes with the hero's image. */}
      {hasImage && (
        <div className="absolute inset-0">
          <Image
            src={image!}
            alt=""
            fill
            sizes="100vw"
            quality={95}
            className="object-cover"
          />
          <div
            className="absolute inset-0 bg-black"
            style={{ opacity: overlayOpacity }}
          />
        </div>
      )}

      {/* Text content */}
      <div
        className="relative max-w-4xl mx-auto text-center"
        style={{
          "--heading-color": hasImage
            ? "var(--color-text-inverse)"
            : "var(--color-text-heading)",
        } as React.CSSProperties}
      >
        <h2 className="heading text-3xl md:text-5xl font-light leading-tight mb-4"
          dangerouslySetInnerHTML={{ __html: heading }}
        />
        {subheading && (
          <p className="text-lg md:text-2xl font-medium">{subheading}</p>
        )}
      </div>
    </section>
  );
}
