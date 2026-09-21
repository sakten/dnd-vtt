import { areaCellKey, pointCell, type FogState } from 'shared';

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

/** Клетки в прямоугольнике между двумя точками (включительно). */
export function fogCellsBetween(a: WorldPoint, b: WorldPoint, fog: FogState): string[] {
  // FogState совпадает с AreaGrid (size/offsetX/offsetY) — клетки считает shared.
  const p0 = pointCell({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) }, fog);
  const p1 = pointCell({ x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) }, fog);
  const keys: string[] = [];
  for (let cx = p0.cx; cx <= p1.cx; cx++) {
    for (let cy = p0.cy; cy <= p1.cy; cy++) keys.push(areaCellKey(cx, cy));
  }
  return keys;
}

/** Клетки в радиусе кисти (круг по клеткам). */
export function fogCellsAround(w: WorldPoint, radius: number, fog: FogState): string[] {
  const center = pointCell(w, fog);
  const keys: string[] = [];
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      if (dx * dx + dy * dy <= radius * radius) keys.push(areaCellKey(center.cx + dx, center.cy + dy));
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
  const p = pointCell({ x, y }, fog);
  return hidden.has(areaCellKey(p.cx, p.cy));
}
