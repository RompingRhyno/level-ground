import { getPages } from "@/lib/pages";
import AdminPagesClient from "@/components/admin/AdminPagesClient";

export type TemplateRow = { slug: string; label: string };
export type PageRow = { slug: string; label: string; templates: TemplateRow[] };

export default async function AdminPagesList() {
  const allPages = await getPages();

  // Pages that aren't typed as templates (candidates for regular rows)
  const allNonTemplates = allPages.filter((p) => (p.type ?? "page") === "page");

  // Build owner map from ALL collection-index sections, and collect every
  // referenced detailTemplateSlug so we can exclude them from regular rows
  // even if their DB type hasn't been corrected to "template" yet.
  const templateOwnerMap = new Map<string, string>();
  const referencedTemplateSlugs = new Set<string>();
  for (const page of allNonTemplates) {
    for (const s of page.sections) {
      if ((s as any).type === "collection-index" && (s as any).detailTemplateSlug) {
        const tSlug = (s as any).detailTemplateSlug as string;
        templateOwnerMap.set(tSlug, page.slug);
        referencedTemplateSlugs.add(tSlug);
      }
    }
  }

  // Also include pages already typed as "template" in the template set
  const typedTemplates = allPages.filter((p) => p.type === "template");
  typedTemplates.forEach((t) => referencedTemplateSlugs.add(t.slug));

  // Regular rows = non-template pages that are NOT themselves a detail template
  const regularPages = allNonTemplates.filter((p) => !referencedTemplateSlugs.has(p.slug));

  // All template pages (typed OR referenced)
  const templates = allPages.filter((p) => referencedTemplateSlugs.has(p.slug));

  const pageRows: PageRow[] = regularPages.map((page) => ({
    slug: page.slug,
    label: page.label,
    templates: templates
      .filter((t) => templateOwnerMap.get(t.slug) === page.slug)
      .map((t) => ({ slug: t.slug, label: t.label })),
  }));

  return (
    <div>
      <div style={{ width: '100vw', marginLeft: 'calc(50% - 50vw)', paddingBottom: '2rem' }}>
        <div className="mx-auto px-6">
          <h1 className="text-2xl font-semibold">Pages</h1>
          <p className="text-sm text-gray-600">Create and manage pages, layouts, and section content.</p>
        </div>
      </div>

      <AdminPagesClient initialPages={pageRows} />
    </div>
  );
}
