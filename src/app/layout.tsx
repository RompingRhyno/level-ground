import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";

export const metadata: Metadata = {
  title: "Level Ground Landscaping",
  description: "Custom landscaping and maintenance services",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <header className="bg-(--color-bg-primary) px-6 py-4">
          <Navigation />
        </header>
        <main>{children}</main>
        <footer className="bg-(--color-bg-secondary) px-6 py-4">
          © 2025 Level Ground Landscaping
        </footer>
      </body>
    </html>
  );
}