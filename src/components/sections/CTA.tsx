import Link from "next/link";
import { CTASection } from "@/types/sections";
import RichText from "@/components/RichText";

export default function CTA({ text, buttonText }: CTASection) {
  return (
    <section className="py-12 bg-gray-100 text-center">
      <div className="max-w-3xl mx-auto">
        <RichText value={text} className="text-xl mb-6" />
        <Link href="/contact" className="btn-primary inline-block">
          {buttonText}
        </Link>
      </div>
    </section>
  );
}
