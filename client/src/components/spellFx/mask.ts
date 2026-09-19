/**
 * Маска видимости для оверлея эффектов: белые клетки — видимые (эффект показывается),
 * прозрачные — скрытые туманом/стенами. Координаты — мировые, CSS растянет маску.
 */
export interface FxMask {
  /** data:image/png — 1 пиксель на клетку. */
  url: string;
  cell: number;
  offsetX: number;
  offsetY: number;
  /** Размер маски в мировых px. */
  width: number;
  height: number;
}

export function buildFxMask(opts: {
  cell: number;
  offsetX: number;
  offsetY: number;
  cols: number;
  rows: number;
  /** Клетки, которые зритель не видит: ключи `"cx,cy"` в координатах сетки. */
  blocked: Iterable<string>;
}): FxMask | null {
  const { cell, offsetX, offsetY, cols, rows } = opts;
  if (cols <= 0 || rows <= 0 || !(cell > 0)) return null;
  const canvas = document.createElement('canvas');
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const blocked = new Set(opts.blocked);
  ctx.fillStyle = '#fff';
  for (let cx = 0; cx < cols; cx++) {
    for (let cy = 0; cy < rows; cy++) {
      if (!blocked.has(`${cx},${cy}`)) ctx.fillRect(cx, cy, 1, 1);
    }
  }
  return { url: canvas.toDataURL(), cell, offsetX, offsetY, width: cols * cell, height: rows * cell };
}
