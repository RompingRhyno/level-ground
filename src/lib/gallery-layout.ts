export type BentoVariant = "normal" | "reverse";

export type Block =
  | { type: "hero" }
  | { type: "bento"; variant: BentoVariant }
  | { type: "triple" }
  | { type: "double" };

export type CellType = "hero" | "bento-large" | "small";

export interface LayoutCell {
  assetIndex: number;
  cellType: CellType;
  colStart: number;
  colSpan: number;
  rowStart: number;
  rowSpan: number;
}

/**
 * Mode A — "bento": Visual Interest Maximizer.
 * Priority: Hero > Bento/Reverse Bento > Double.
 * Remainder rule: n%3===1 → Hero at top; n%3===2 → Double at end.
 */
export function decomposeBlocksModeA(n: number): Block[] {
  if (n <= 0) return [];
  if (n === 1) return [{ type: "hero" }];
  if (n === 2) return [{ type: "double" }];

  const blocks: Block[] = [];
  let rem = n;

  if (rem % 3 === 1) {
    blocks.push({ type: "hero" });
    rem -= 1;
  }

  let bentoCount = 0;
  while (rem >= 3) {
    blocks.push({ type: "bento", variant: bentoCount % 2 === 0 ? "normal" : "reverse" });
    bentoCount++;
    rem -= 3;
  }

  if (rem === 2) blocks.push({ type: "double" });

  return blocks;
}

/**
 * Mode B — "grid": Orphan Resolver.
 * Primary structure: Triple rows.
 * Priority order: Hero > Double > Triple.
 * Remainder rule: n%3===1 → Hero at top; n%3===2 → Double at top (before triples).
 */
export function decomposeBlocksModeB(n: number): Block[] {
  if (n <= 0) return [];
  if (n === 1) return [{ type: "hero" }];
  if (n === 2) return [{ type: "double" }];

  const blocks: Block[] = [];
  let rem = n;
  let heroBlock: Block | null = null;
  let doubleBlock: Block | null = null;

  if (rem % 3 === 1) {
    heroBlock = { type: "hero" };
    rem -= 1;
  } else if (rem % 3 === 2) {
    doubleBlock = { type: "double" };
    rem -= 2;
  }

  if (heroBlock) blocks.push(heroBlock);
  if (doubleBlock) blocks.push(doubleBlock);

  while (rem >= 3) {
    blocks.push({ type: "triple" });
    rem -= 3;
  }

  return blocks;
}

/**
 * Convert an ordered block list into explicit CSS Grid placement cells.
 * - hero / small cells: carry aspect-ratio responsibility (add aspect-video class).
 * - bento-large cells: NO aspect-ratio — height is determined by adjacent small cells
 *   in the same two grid rows (2 × small_height + gap). Use object-cover on the image.
 */
export function buildCells(blocks: Block[]): LayoutCell[] {
  const cells: LayoutCell[] = [];
  let idx = 0;
  let row = 1;

  for (const block of blocks) {
    switch (block.type) {
      case "hero":
        cells.push({
          assetIndex: idx++,
          cellType: "hero",
          colStart: 1, colSpan: 3,
          rowStart: row, rowSpan: 1,
        });
        row += 1;
        break;

      case "bento": {
        const norm = block.variant === "normal";
        // Large image first in source order; left 2 cols (normal) or right 2 cols (reverse)
        cells.push({
          assetIndex: idx++,
          cellType: "bento-large",
          colStart: norm ? 1 : 2, colSpan: 2,
          rowStart: row, rowSpan: 2,
        });
        // Top small
        cells.push({
          assetIndex: idx++,
          cellType: "small",
          colStart: norm ? 3 : 1, colSpan: 1,
          rowStart: row, rowSpan: 1,
        });
        // Bottom small
        cells.push({
          assetIndex: idx++,
          cellType: "small",
          colStart: norm ? 3 : 1, colSpan: 1,
          rowStart: row + 1, rowSpan: 1,
        });
        row += 2;
        break;
      }

      case "triple":
        for (let c = 1; c <= 3; c++) {
          cells.push({
            assetIndex: idx++,
            cellType: "small",
            colStart: c, colSpan: 1,
            rowStart: row, rowSpan: 1,
          });
        }
        row += 1;
        break;

      case "double":
        cells.push({
          assetIndex: idx++,
          cellType: "small",
          colStart: 1, colSpan: 1,
          rowStart: row, rowSpan: 1,
        });
        cells.push({
          assetIndex: idx++,
          cellType: "small",
          colStart: 2, colSpan: 1,
          rowStart: row, rowSpan: 1,
        });
        row += 1;
        break;
    }
  }

  return cells;
}

/** Convenience: decompose + build in one call. */
export function getLayoutCells(n: number, mode: "bento" | "grid"): LayoutCell[] {
  return buildCells(mode === "bento" ? decomposeBlocksModeA(n) : decomposeBlocksModeB(n));
}

/** Appropriate Next.js Image `sizes` hint per cell type in a max-3-column grid. */
export function getCellSizes(cellType: CellType): string {
  if (cellType === "hero") return "100vw";
  if (cellType === "bento-large") return "(min-width:768px) 66vw, 100vw";
  return "(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw";
}