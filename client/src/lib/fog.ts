import type { FogState } from 'shared';

export interface WorldPoint {
  x: number;
  y: number;
}

export interface CellRect {
  x: number;
  y: number;
  size: number;
}

export interface RectPreview {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Индекс клетки по мировой координате. */
export function cellIndex(v: number, offset: number, size: number): number {
  return Math.floor((v - offset) / size);
}

export function cellKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

/** Клетки в прямоугольнике между двумя точками (включительно). */
export function fogCellsBetween(a: WorldPoint, b: WorldPoint, fog: FogState): string[] {
  const cx0 = cellIndex(Math.min(a.x, b.x), fog.offsetX, fog.size);
  const cx1 = cellIndex(Math.max(a.x, b.x), fog.offsetX, fog.size);
  const cy0 = cellIndex(Math.min(a.y, b.y), fog.offsetY, fog.size);
  const cy1 = cellIndex(Math.max(a.y, b.y), fog.offsetY, fog.size);
  const keys: string[] = [];
  for (let cx = cx0; cx <= cx1; cx++) {
    for (let cy = cy0; cy <= cy1; cy++) keys.push(cellKey(cx, cy));
  }
  return keys;
}

/** Клетки в радиусе кисти (круг по клеткам). */
export function fogCellsAround(w: WorldPoint, radius: number, fog: FogState): string[] {
  const ccx = cellIndex(w.x, fog.offsetX, fog.size);
  const ccy = cellIndex(w.y, fog.offsetY, fog.size);
  const keys: string[] = [];
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      if (dx * dx + dy * dy <= radius * radius) keys.push(cellKey(ccx + dx, ccy + dy));
    }
  }
  return keys;
}

/** Новое состояние тумана после скрытия/показа клеток (вход не мутируется). */
export function withFogCells(fog: FogState, keys: string[], action: 'hide' | 'reveal'): FogState {
  const set = new Set(fog.hidden);
  if (action === 'hide') keys.forEach((k) => set.add(k));
  else keys.forEach((k) => set.delete(k));
  return { ...fog, hidden: [...set] };
}

/** Прямоугольники скрытых клеток для рендера. */
export function fogRects(fog: FogState): CellRect[] {
  const out: CellRect[] = [];
  for (const key of fog.hidden) {
    const [cx, cy] = key.split(',').map(Number);
    if (cx === undefined || cy === undefined) continue;
    out.push({ x: fog.offsetX + cx * fog.size, y: fog.offsetY + cy * fog.size, size: fog.size });
  }
  return out;
}

/** Скрыта ли точка туманом: общий visibleCell для токенов и DOM-оверлеев. */
export function isCellHidden(
  fog: FogState | undefined,
  hidden: Set<string>,
  x: number,
  y: number
): boolean {
  if (!fog) return false;
  return hidden.has(cellKey(cellIndex(x, fog.offsetX, fog.size), cellIndex(y, fog.offsetY, fog.size)));
}
