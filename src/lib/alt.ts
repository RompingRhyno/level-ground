/**
 * Alt text for a project's photos, generated from its tags.
 *
 * The default: a folder's first `ALT_TAG_COUNT` tags, in their stored order, name the alt text for
 * every photo in that folder. The order is operator-controlled in the media library (click to
 * activate, drag the ⋮ to reorder), so this file only defines the sentence shape and the budget —
 * the words come from the tag list.
 *
 * Rules, decided 2026-10-13:
 * - Up to four covers; the sentence never exceeds `ALT_MAX_CHARS`, and over-long cases drop the
 *   last cover rather than truncating mid-word.
 * - No locale and no brand tail: the LocalBusiness schema states the location authoritatively and
 *   the alt's budget is better spent on cover terms.
 * - Same string for every photo in a folder, on purpose (before/after frames included).
 */

export const ALT_TAG_COUNT = 4;
export const ALT_MAX_CHARS = 125;

/** Build the alt sentence for one folder's tag names. Pure, so callers can preview without writing. */
export function altTextForTagNames(folderName: string, tagNames: string[]): string {
  const build = (list: string[]) =>
    list.length === 0
      ? `${folderName} project.`
      : list.length === 1
        ? `${list[0]} at the ${folderName} project.`
        : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]} at the ${folderName} project.`;

  let used = tagNames.slice(0, ALT_TAG_COUNT);
  let alt = build(used);
  while (alt.length > ALT_MAX_CHARS && used.length > 1) {
    used = used.slice(0, -1);
    alt = build(used);
  }
  return alt;
}
