import Link from "next/link";

export default function AdminPage() {
  return (
    <div style={{ width: '100vw', marginLeft: 'calc(50% - 50vw)', padding: '2rem 0' }}>
      <div className="max-w-7xl mx-auto px-4">
        <h2 className="text-xl font-semibold mb-8" style={{ color: 'var(--color-text-heading)' }}>Dashboard</h2>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Link
            href="/admin/pages"
            className="group block rounded-xl p-6 transition-all duration-150 hover:shadow-md"
            style={{ backgroundColor: 'var(--color-bg-secondary)' }}
          >
            <div className="mb-2 text-lg font-semibold" style={{ color: 'var(--color-text-heading)' }}>Pages</div>
            <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
              Create and edit pages, manage layouts, and update section content.
            </p>
          </Link>

          <Link
            href="/admin/files"
            className="group block rounded-xl p-6 transition-all duration-150 hover:shadow-md"
            style={{ backgroundColor: 'var(--color-bg-secondary)' }}
          >
            <div className="mb-2 text-lg font-semibold" style={{ color: 'var(--color-text-heading)' }}>Media</div>
            <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
              Upload and organise images and files used across the site.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
