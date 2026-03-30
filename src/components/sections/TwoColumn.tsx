import Image from "next/image";
import { TwoColumnSection } from "@/types/sections";

export default function TwoColumn({ title, body, image }: TwoColumnSection) {
  return (
    <section className="py-12">
      <div className="mx-auto max-w-7xl grid gap-8 md:grid-cols-2 items-center px-6">
        <div>
          <h2 className="text-3xl font-semibold mb-4">{title}</h2>
          <p className="text-gray-700">{body}</p>
        </div>

        <div>
          <div className="relative h-64 w-full rounded-lg overflow-hidden shadow">
            <Image
              src={image}
              alt={title}
              fill
              sizes="(min-width:1024px) 50vw, 100vw"
              className="object-cover"
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </section>
  );
}