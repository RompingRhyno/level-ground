import Link from "next/link";
import { CTASection } from "@/types/sections";

export default function CTA({ text, buttonText }: CTASection) {
  return (
    <section className="py-12 bg-gray-100 text-center">
      <div className="max-w-3xl mx-auto">
        <p className="text-xl mb-6">{text}</p>
        <Link href="/contact" className="btn-primary inline-block">
          {buttonText}
        </Link>
      </div>
    </section>
  );
}
