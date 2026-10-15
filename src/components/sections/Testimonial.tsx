import RichText from "@/components/RichText";

/**
 * A client testimonial as a speech bubble: a pill drawn with the same mechanism as the site's pill
 * buttons (`rounded-full` → border-radius 9999px, so the ends are true semicircles at any size),
 * outlined in 2px on white, with a pointed tail at the bottom-right.
 *
 * Tail join: the SVG's top edge sits exactly on the top edge of the pill's border, so the arm tips
 * are cut horizontally by the viewport (no overshoot above the border), and a white rect masks the
 * border across the mouth with its edges lined up with the arms' outer edges — the outline runs
 * border → arm with no step. The tip of the V is the point; the name below carries the same
 * percentage offset, so the point aims at it at any width.
 */
export default function Testimonial({ text, name }: { text?: string; name?: string }) {
  const quote = (text ?? "").trim();
  const reviewer = (name ?? "").trim();
  if (!quote && !reviewer) return null;

  return (
    <div className="flex flex-col items-center px-4 md:px-8">
      {quote && (
        <div className="relative w-full max-w-[60rem] rounded-[4rem] border-2 border-(--color-text-dark) md:rounded-full">
          <RichText
            value={quote}
            className="px-10 py-12 text-center text-lg leading-relaxed md:px-14 md:py-10"
            style={{ color: "var(--color-text-dark)" }}
          />
          {/* -bottom-11 (44px = the SVG height) puts the SVG's top edge exactly on the border's top
              edge: `bottom` resolves against the padding box (inside the 2px border), so the SVG's
              own height lines up local y=0 with the border's top edge. Arm tips are cut there — flush
              with the border, no overshoot — and the mask rect's edges (x 5.4 / 82.6) sit ~1px inside
              where the arms' outer edges cross the border's bottom edge, overlapping the border into
              the arm so no light seam can show at the junction. */}
          <svg
            className="absolute -bottom-11 right-[calc(23%_-_44px)] h-11 w-22 overflow-hidden"
            aria-hidden="true"
          >
            <rect x="5.4" y="0" width="77.2" height="4" fill="white" />
            <path
              d="M -0.2 -4 L 44 40.2 L 88.2 -4"
              fill="none"
              stroke="var(--color-text-dark)"
              strokeWidth="2"
            />
          </svg>
        </div>
      )}
      {reviewer && (
        <div className="w-full max-w-[60rem] px-[2px]">
          <p className="mt-16 text-right text-base md:text-lg" style={{ fontFamily: "var(--font-heading)", fontWeight: 500, color: "var(--color-text-dark)" }}>
            {/* mr-23% puts the name's right edge where the tail's tip is; translating by half its own
                width then centres the name on the tip, whatever its length. */}
            <span className="mr-[23%] inline-block translate-x-1/2">{reviewer}</span>
          </p>
        </div>
      )}
    </div>
  );
}
