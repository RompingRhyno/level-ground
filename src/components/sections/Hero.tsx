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
  return (
    <section className="relative mx-auto max-w-7xl px-6">
      <div className="grid items-center gap-12 md:grid-cols-2">
        {/* Image */}
        <div className="order-1 flex justify-center md:order-2 md:justify-start">
          <div
            className="
              relative
              aspect-square
              w-[320px]
              sm:w-95
              md:w-110
              rounded-full
              shadow-xl
            "
            style={{
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
            }}
          >
            <Image
              src={image}
              alt=""
              fill
              priority
              className="rounded-full object-cover"
            />
          </div>
        </div>

        {/* Text */}
        <div className="order-2 text-center md:order-1 md:text-right">
          <h1
            className="heading text-3xl md:text-5xl font-light tracking-tight"
            dangerouslySetInnerHTML={{ __html: heading }}
          />

          {subheading && (
            <p
              className="mt-4 text-base md:text-lg"
              style={{
                color: "var(--color-text-primary)",
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
