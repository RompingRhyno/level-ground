import Image from "next/image";
import { TwoColumnSection } from "@/types/sections";

export default function TwoColumn({ title, body, image }: TwoColumnSection) {
  return (
    <section className="py-12">
      <div className="w-full grid gap-8 md:grid-cols-2 items-center">
        <div className="px-4 md:px-8 md:max-w-2xl">
          <h2 className="text-3xl font-semibold mb-4">{title}</h2>
          <p className="text-(--color-text-dark)">{body}</p>
        </div>

        <div>
          <div className="relative aspect-video w-full overflow-hidden rounded-lg shadow">
            {image ? (
              <Image
                src={image}
                alt={title}
                fill
                sizes="(min-width:1024px) 50vw, 100vw"
                quality={90}
                className="object-cover"
                loading="lazy"
              />
            ) : (
              <div className="absolute inset-0 bg-(--color-bg-secondary)" />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
