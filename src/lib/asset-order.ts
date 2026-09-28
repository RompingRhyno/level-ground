/**
 * Serialise `orderIndex` assignment inside one folder.
 *
 * A batch upload fires one POST per file in parallel, and each request runs
 * `aggregate(_max.orderIndex)` → `create()` in a transaction. Under read-committed isolation every one of
 * them reads the same maximum, so all but the first insert violate `@@unique([folder, orderIndex])` and the
 * file's upload fails with a Prisma constraint error. Locking the folder row makes the read-then-insert
 * atomic per folder; different folders still proceed in parallel.
 *
 * Call this *before* reading the maximum, inside the same transaction.
 */
export async function lockFolderForOrdering(tx: any, folderSlug: string) {
  await tx.$queryRaw`SELECT id FROM "Folder" WHERE slug = ${folderSlug} FOR UPDATE`;
}

/** Natural, case-insensitive filename order — `West2` before `West10`, `alder` beside `Alder`. */
const nameCollator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

export function compareAssetNames(a: string, b: string) {
  return nameCollator.compare(a, b);
}

/**
 * Where a newly uploaded file belongs in a folder's existing sequence: how many stored files sort before it.
 *
 * Fresh uploads are ordered by name, but the *existing* sequence must not be rearranged — a folder the
 * operator has dragged into a custom order keeps that order, and the new file simply takes the slot its
 * name earns among them. Batch uploads finish in arbitrary order, so this is decided per file rather than
 * assumed from arrival order (otherwise a file that uploads a moment faster jumps the queue).
 */
export async function nameInsertionSlot(tx: any, folderSlug: string, filename: string) {
  const existing = (await tx.asset.findMany({
    where: { folder: folderSlug, orderIndex: { not: null } },
    select: { id: true, filename: true, orderIndex: true },
    orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
  })) as { id: string; filename: string | null; orderIndex: number }[];

  const slot = existing.filter((a) => compareAssetNames(a.filename ?? "", filename) <= 0).length;
  return { slot, tail: existing.slice(slot) };
}
