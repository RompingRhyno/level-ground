import type { Metadata } from "next";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import { getNavPages } from "@/lib/pages";

export const metadata: Metadata = {
  title: "Level Ground Landscaping",
  description: "Custom landscaping and maintenance services",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const navPages = (await getNavPages()).filter((p) => p.slug !== "home");

  return (
    <html lang="en">
      <body className="antialiased">
        <SiteHeader navPages={navPages} />
        <main>{children}</main>
        <footer className="bg-(--color-bg-secondary) px-6 py-4">
          © 2025 Level Ground Landscaping
        </footer>
      </body>
    </html>
  );
}