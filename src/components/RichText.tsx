import type { CSSProperties, ReactNode } from "react";

/**
 * Renders an admin-authored body/copy field.
 *
 * These fields are edited through `RichContentEditable`, so what is stored is HTML — `<strong>` and
 * `<em>` from the toolbar, `<br>` for line breaks. Older values are plain text, sometimes with literal
 * newlines, so those are converted to breaks before rendering. Everything is authored by the site
 * owner in the admin, the same trust level as the section headings, which already render this way.
 *
 * `whitespace` is deliberately not relied on: the editor stores breaks as elements, and a heading or
 * paragraph that also has `pre-line` would double-space them.
 */
export default function RichText({
  value,
  className,
  style,
  as: Tag = "p",
}: {
  value?: string | null;
  className?: string;
  style?: CSSProperties;
  as?: "p" | "div" | "span" | "h1" | "h2" | "h3";
}): ReactNode {
  const raw = value ?? "";
  // Break-only or whitespace-only content (e.g. a body the editor left as "<br>") is empty in effect:
  // render nothing, or it takes a gap in a spaced stack while showing nothing.
  if (!raw.replace(/<[^>]*>/g, "").replace(/&nbsp;|\u00a0/g, "").trim()) return null;
  const html = raw.replace(/\r\n?/g, "\n").replace(/\n/g, "<br />");
  return <Tag className={className} style={style} dangerouslySetInnerHTML={{ __html: html }} />;
}
