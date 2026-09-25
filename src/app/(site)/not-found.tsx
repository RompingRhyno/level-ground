import Link from "next/link";

/**
 * 404 for the public site. Used when a collection entity (project folder) is missing or hidden
 * from /projects — `notFound()` from the detail route lands here.
 */
export default function NotFound() {
  return (
    <section className="min-h-[60vh] flex items-center justify-center px-6 py-24">
      <div className="max-w-xl text-center">
        <p className="text-sm uppercase tracking-widest mb-3" style={{ color: "var(--color-brand-accent)" }}>
          Not found
        </p>
        <h1 className="heading text-3xl sm:text-4xl font-light mb-4" style={{ color: "var(--color-text-heading)" }}>
          That page isn&rsquo;t here
        </h1>
        <p className="mb-8" style={{ color: "var(--color-text-primary)" }}>
          The project you&rsquo;re looking for may have been renamed or is no longer listed. Browse the full
          portfolio instead.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/projects"
            className="px-5 py-2 rounded-full text-base font-medium transition-colors border border-(--tag-border-color) bg-(--btn-primary-bg) text-(--btn-primary-text) hover:bg-(--btn-select) hover:text-(--btn-select-text)"
          >
            Browse all projects
          </Link>
          <Link
            href="/"
            className="px-5 py-2 rounded-full text-base font-medium transition-colors border border-(--tag-border-color) bg-(--btn-primary-bg) text-(--btn-primary-text) hover:bg-(--btn-select) hover:text-(--btn-select-text)"
          >
            Home
          </Link>
        </div>
      </div>
    </section>
  );
}
