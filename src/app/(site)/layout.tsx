import SiteHeader from "@/components/SiteHeader";
import { getNavPages } from "@/lib/pages";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const navPages = (await getNavPages()).filter((p) => p.slug !== "home");

  return (
    <div className="min-h-dvh flex flex-col">
      <SiteHeader navPages={navPages} />
      <main className="flex-1">{children}</main>
      <footer className="bg-(--color-bg-secondary) px-6 py-4">
        © {new Date().getFullYear()} Level Ground Landscaping
      </footer>
    </div>
  );
}
