import Link from "next/link";
import Image from "next/image";
import { pages } from "@/lib/mockPages";

export default function Navigation() {
  return (
    <nav className="flex items-center justify-between px-6 py-4">
      {/* Logo on the left */}
      <div>
        <Link href="/">
          <Image
            src="/logo-dark.webp"
            alt="Level Ground Landscaping"
            width={252}
            height={36}
          />
        </Link>
      </div>

      {/* Buttons on the right */}
      <div className="flex gap-12">
        {pages
          .filter((page) => page.slug !== "home")
          .map((page) => (
            <Link
              key={page.slug}
              href={`/${page.slug}`}
              className="font-medium uppercase"
            >
              {page.label}
            </Link>
          ))}
      </div>
    </nav>
  );
}
