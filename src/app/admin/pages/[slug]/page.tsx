"use client";

import { notFound } from "next/navigation";
import { getPageBySlug } from "@/lib/pages";
import AdminPageEditor from "@/components/admin/AdminPageEditor";

type Props = {
  params: {
    slug: string;
  };
};

export default async function AdminPageDetail({ params }: Props) {
  const page = await getPageBySlug(params.slug as string);

  if (!page) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{page.label}</h2>
        <p className="text-gray-600">/{page.slug}</p>
      </div>

      <AdminPageEditor initialPage={page} />
    </div>
  );
}
