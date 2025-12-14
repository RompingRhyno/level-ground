// app/components/sections/Gallery.tsx

type Props = {
  images: string[];
};

export default function Gallery({ images }: Props) {
  return (
    <section className="py-12">
      <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {images.map((src, index) => (
          <img
            key={index}
            src={src}
            alt=""
            className="w-full h-64 object-cover"
          />
        ))}
      </div>
    </section>
  );
}
