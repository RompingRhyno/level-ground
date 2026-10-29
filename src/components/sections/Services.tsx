import Image from "next/image";
import RichText from "@/components/RichText";
import Link from "next/link";

type ServiceItem = {
    title: string;
    image: string;
    href: string;
};

type ServicesProps = {
    heading: string;
    services: ServiceItem[];
    bodyText?: string;
};

export default function Services({
    heading,
    services,
    bodyText,
}: ServicesProps) {
    return (
        <section className="w-full">
            {/* Heading */}
            <div className="px-4 md:px-8">
                <h2
                    className="heading max-w-4xl text-3xl sm:text-3xl md:text-5xl font-light leading-tight mb-12"
                    dangerouslySetInnerHTML={{ __html: heading }}
                />
            </div>

            {/* Services grid — full bleed: two columns of the whole width, cards flush with the edges,
                gap-8 as the gutter between them. */}
            <div className="grid gap-8 sm:grid-cols-2">
                {services.map((service, index) => (
                    <Link
                        key={index}
                        href={service.href}
                        className="group relative block overflow-hidden rounded-2xl"
                    >
                        {/* Image */}
                        <div className="relative aspect-4/3">
                            {service.image ? (
                                <Image
                                    src={service.image}
                                    alt={service.title}
                                    fill
                                    sizes="(min-width:640px) 50vw, 100vw"
                                    quality={90}
                                    className="object-cover transition-transform duration-[1000ms] group-hover:will-change-transform group-hover:[transform:scale(1.03)]"
                                    loading="lazy"
                                />
                            ) : (
                                <div className="absolute inset-0 bg-(--color-bg-secondary)" />
                            )}
                        </div>

                        {/* Overlay */}
                        <div className="absolute inset-0 bg-black/25 transition-opacity duration-300 group-hover:opacity-0" />
                        {/* Title */}
                        <div className="absolute inset-0 flex items-end p-6">
                            <h3 className="text-2xl md:text-4xl font-semibold text-white leading-tight">
                                {service.title}
                            </h3>

                        </div>
                    </Link>
                ))}
            </div>

            {/* Body text */}
            {bodyText && (
                <RichText
                    value={bodyText}
                    className="mt-10 max-w-3xl mx-auto px-4 md:px-8 text-center text-(--color-text-primary)"
                />
            )}
        </section>
    );
}
