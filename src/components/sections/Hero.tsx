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
    <section className="relative w-full px-4 md:px-8">
      <div className="grid items-center gap-12 md:grid-cols-2">
        {/* Image */}
        <div className="order-1 flex justify-center md:order-2 md:justify-start">
          <div
            className={`
              relative
              aspect-square
              w-[min(320px,100%)]
              sm:w-95
              md:w-110
              max-w-full
              rounded-full
              shadow-xl
            `}
            style={{
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
            }}
          >
            {image ? (
              <Image
                src={image}
                alt=""
                fill
                priority
                sizes="(min-width: 768px) 440px, (min-width: 640px) 380px, 320px"
                quality={95}
                className="rounded-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 rounded-full bg-(--color-bg-secondary)" />
            )}
          </div>
        </div>

        {/* Text */}
        <div className="order-2 text-center md:order-1 md:ml-auto md:max-w-2xl md:text-right">
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
