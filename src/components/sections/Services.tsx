import Image from "next/image";
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
        <section className="px-8">
            {/* Heading */}
            <h2
                className="heading text-3xl sm:text-3xl md:text-5xl font-light leading-tight mb-12"
                dangerouslySetInnerHTML={{ __html: heading }}
            />

            {/* Services grid */}
            <div className="grid gap-8 sm:grid-cols-2">
                {services.map((service, index) => (
                    <Link
                        key={index}
                        href={service.href}
                        className="group relative block overflow-hidden rounded-lg"
                    >
                        {/* Image */}
                        <div className="relative aspect-4/3">
                            <Image
                                src={service.image}
                                alt={service.title}
                                fill
                                sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"
                                className="object-cover transition-transform duration-500 group-hover:scale-105"
                                loading="lazy"
                            />
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
                <p className="mt-10 max-w-3xl mx-auto text-center text-[var(--color-text-primary)]">
                    {bodyText}
                </p>
            )}
        </section>
    );
}
