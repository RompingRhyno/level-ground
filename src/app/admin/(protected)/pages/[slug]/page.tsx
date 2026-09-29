import Link from "next/link";
import { notFound } from "next/navigation";
import { getPageBySlug } from "@/lib/pages";
import AdminPageEditor from "@/components/admin/pageEditor";

type Props = {
  params: {
    slug: string;
  };
};

export default async function AdminPageDetail({ params }: Props) {
  const { slug } = await params;
  const page = await getPageBySlug(slug as string);

  if (!page) notFound();

  return (
    <div className="space-y-6">
      {/* Back navigation — mirrors the media folder page */}
      <div>
        <Link
          href="/admin/pages"
          className="inline-flex items-center gap-1 text-sm text-(--color-brand-dark) hover:underline"
        >
          <span aria-hidden="true">←</span> All pages
        </Link>
      </div>

      <div>
        <h2 className="text-xl font-semibold">{page.label}</h2>
        <p className="text-(--color-text-dark)">/{page.slug}</p>
      </div>

      <AdminPageEditor initialPage={page} />
    </div>
  );
}
