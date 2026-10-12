import type { Metadata } from "next";
import "./globals.css";
import { NOINDEX, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // Route-level fallback: every public route exports its own title/description via `buildMetadata`.
  title: "Level Ground Landscape",
  description: "Residential landscaping design, construction and maintenance in Vancouver, BC.",
  // Pre-launch indexing lock; see `NOINDEX` in lib/seo.ts and the cutover steps in docs/handoff.md.
  robots: NOINDEX ? { index: false, follow: false } : undefined,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}