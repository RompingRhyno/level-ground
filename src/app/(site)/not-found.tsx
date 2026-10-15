import Link from "next/link";
import NotFoundAnimation from "@/components/NotFoundAnimation";

/**
 * 404 for the public site — layout ported from the original WordPress 404: big numeral and
 * message on the left, the gardener Lottie on the right. Recoloured for the current theme
 * (white background, dark-green type). Desktop type sizes match the original exactly
 * (150px / 39px, weights 500 / 300); the smaller steps are tuned for narrow screens.
 *
 * Used when a collection entity (project folder) is missing or hidden from /projects —
 * `notFound()` from the detail route lands here.
 */
export default function NotFound() {
  return (
    <section className="min-h-[70vh] flex items-center px-6 py-20">
      <div className="w-[90vw] max-w-[1200px] mx-auto grid gap-12 md:grid-cols-2 md:gap-8 items-center">
        <div className="text-center">
          <div
            className="leading-none text-[88px] sm:text-[120px] md:text-[150px]"
            style={{ fontFamily: "var(--font-heading)", fontWeight: 500, color: "var(--color-text-dark)" }}
          >
            404
          </div>
          <h1
            className="mt-4 text-[20px] sm:text-[26px] md:text-[39px] capitalize"
            style={{ fontFamily: "var(--font-heading)", fontWeight: 300, color: "var(--color-text-dark)" }}
          >
            The page you were looking for couldn&rsquo;t be found
          </h1>
          <div className="mt-8 flex items-center justify-center">
            <Link
              href="/"
              className="px-5 py-2 rounded-full text-base font-medium transition-colors border border-(--tag-border-color) bg-(--btn-primary-bg) text-(--btn-primary-text) hover:bg-(--btn-select) hover:text-(--btn-select-text)"
            >
              Back to Level Ground
            </Link>
          </div>
        </div>
        <NotFoundAnimation />
      </div>
    </section>
  );
}
