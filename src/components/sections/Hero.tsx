// components/sections/Hero.tsx
import Image from "next/image";

type Props = {
  heading: string;
  subheading?: string;
  image: string;
};

export default function Hero({ heading, subheading, image }: Props) {
  return (
    <section className="relative h-[70vh] flex items-center justify-center">
      <Image
        src={image}
        alt=""
        fill
        className="object-cover"
        priority
      />
      <div className="relative z-10 text-center text-white">
        <h1 className="text-4xl font-bold">{heading}</h1>
        {subheading && <p className="mt-4 text-lg">{subheading}</p>}
      </div>
    </section>
  );
}
