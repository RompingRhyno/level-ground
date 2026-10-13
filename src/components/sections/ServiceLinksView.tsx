type Item = { slug: string; name: string };

/**
 * The pure view for the Service links section: the service pills, styled exactly like the
 * collection index's first-level pills, each an in-page `#<slug>` anchor to the service's section
 * on the same page. `shownSlugs` narrows the list to the services this page actually carries a
 * section for (null keeps the whole vocabulary, which is what the editor preview shows).
 *
 * Deliberately free of server imports: the editor preview is a client component and must be able
 * to import this file. The server wrapper that fetches the vocabulary lives in ServiceLinks.tsx.
 */
export function ServiceLinksView({
  services,
  shownSlugs,
}: {
  services: Item[];
  shownSlugs: string[] | null;
}) {
  const items = shownSlugs ? services.filter((s) => shownSlugs.includes(s.slug)) : services;
  if (!items.length) return null;
  return (
    <div className="px-4 md:px-8 flex flex-wrap gap-2">
      {items.map((s) => (
        <a
          key={s.slug}
          href={`#${s.slug}`}
          className="px-4 py-1 rounded-full text-base transition-colors border border-(--tag-border-color) bg-(--btn-primary-bg) text-(--btn-primary-text) hover:bg-(--btn-select) hover:text-(--btn-select-text)"
        >
          {s.name}
        </a>
      ))}
    </div>
  );
}
