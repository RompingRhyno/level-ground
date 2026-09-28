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
