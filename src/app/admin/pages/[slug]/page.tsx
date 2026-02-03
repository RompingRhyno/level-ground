import { notFound } from "next/navigation";
import { pages } from "@/lib/mockPages";

type Props = {
  params: {
    slug: string;
  };
};

export default function AdminPageDetail({ params }: Props) {
  const page = pages.find((p) => p.slug === params.slug);

  if (!page) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{page.label}</h2>
        <p className="text-gray-600">/{page.slug}</p>
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold">Sections</h3>

        <ul className="space-y-2">
          {page.sections.map((section, index) => (
            <li
              key={index}
              className="rounded border bg-white px-4 py-3"
            >
              <strong className="uppercase text-sm text-gray-500">
                {section.type}
              </strong>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
