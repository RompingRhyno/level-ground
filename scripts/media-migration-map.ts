/**
 * Shared data for the media format migration (steps 2–6). Plan: docs/media-migration-plan.md.
 *
 * Both `media-migration-dry-run.ts` and `media-migration-apply.ts` import this, so the folder mapping and the
 * name-matching rules can never drift apart between the report the operator approved and the run that
 * changes data.
 */
import path from "node:path";

export const JPG_ROOT = "/mnt/Big_D/LGL JPG";

/** [local dir, DB folder slug] — from docs/media-migration-plan.md (30 project folders). */
export const MAP: [string, string][] = [
  ["AlderSt", "alder-st"],
  ["Bayswater", "bayswater-st"],
  ["CartierSt", "cartier-st"],
  ["CypressSt", "cypress-st"],
  ["DukeSt", "duke-st"],
  ["Dunbar-patio", "dunbar-st---patio"],
  ["DunbarSt-Kits", "dunbar-st---backyard"],
  ["East12", "east-12th"],
  ["East22", "east-22nd"],
  ["E.Broadway-condo", "east-broadway---condo"],
  ["ElliotSt", "elliot-st"],
  ["ElmhurstDr", "elmhurst-dr"],
  ["ElmSt", "elm-st"],
  ["LarchSt", "larch-st"],
  ["SouthSurrey", "south-surrey"],
  ["West10", "west-10th"],
  ["West11", "west-11th"],
  ["West11-patio", "west-11th---patio"],
  ["West14", "west-14th"],
  ["West15", "west-15th"],
  ["West24", "west-24th"],
  ["West29", "west-29th"],
  ["West31", "west-31st"],
  ["West32", "west-32nd"],
  ["West35", "west-35th"],
  ["West35-curb", "west-35---curb"],
  ["West6", "west-6th"],
  ["West9", "west-9th"],
  ["WestVan", "west-vancouver"],
  ["WiltshireSt", "wiltshire-st"],
];

/**
 * Stored names that no longer match the disk after the operator's rename: [dbPrefix, localPrefix].
 * west-10th's files were uploaded as `West15-frontgarden_*` (copied from the West15 set) and renamed to
 * `West10_*` on disk; matching strips the prefix before comparing stems.
 */
export const RENAME_STEMS: Record<string, [string, string][]> = {
  "west-10th": [["West15-frontgarden_", "West10_"]],
};

export const stem = (name: string) => name.replace(/\.[^.]+$/, "");
export const mb = (b: number) => `${(b / 1048576).toFixed(1)} MB`;
export const localFile = (localDir: string, name: string) => path.join(JPG_ROOT, localDir, name);

export function canonicalStem(folderSlug: string, name: string) {
  let s = stem(name);
  for (const [dbPrefix, localPrefix] of RENAME_STEMS[folderSlug] ?? []) {
    if (s.startsWith(dbPrefix)) s = localPrefix + s.slice(dbPrefix.length);
  }
  return s;
}

export type Row = {
  id: string;
  folder: string | null;
  filename: string | null;
  storageKey: string;
  publicUrl: string | null;
  mime: string | null;
  size: number | null;
  orderIndex: number | null;
  width: number | null;
  height: number | null;
  meta: unknown;
};

/**
 * What each stored file needs. Same rules as the dry-run report the operator signed off on:
 * upgrade (PNG object → converted JPEG), rename-only (JPEG whose stored name changed), keep (untouched),
 * create (no row), dupe (extra row for the same folder+name).
 */
export type PlanEntry = {
  localDir: string;
  slug: string;
  name: string; // local file name in the converted tree
  action: "upgrade" | "rename-only" | "keep" | "create";
  row?: Row;
  dupes: Row[];
};
