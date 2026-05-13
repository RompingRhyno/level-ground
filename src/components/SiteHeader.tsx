"use client";

import { usePathname } from "next/navigation";
import Navigation from "@/components/Navigation";

type NavPage = { slug: string; label: string };

export default function SiteHeader({ navPages }: { navPages: NavPage[] }) {
  const pathname = usePathname() ?? "";
  const isAdmin = pathname.startsWith("/admin");

  return (
    <header className={isAdmin ? "" : "sticky top-0 z-50"}>
      <Navigation navPages={navPages} />
    </header>
  );
}
