// app/components/sections/Gallery.tsx
import Image from "next/image";
import { GallerySection } from "@/types/sections";

export default function Gallery({ images }: GallerySection) {
  return (
    <section className="py-12">
      <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {images.map((src, index) => (
          <div key={index} className="relative h-64 w-full rounded overflow-hidden">
            <Image src={src} alt="" fill className="object-cover" />
          </div>
        ))}
      </div>
    </section>
  );
}
