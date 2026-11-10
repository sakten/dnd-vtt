import { areaCellKey, type Wall } from 'shared';

/** Сетка, по которой режем стены на участки (клетка + смещение). */
export interface WallGrid {
  size: number;
  offsetX: number;
  offsetY: number;
}

/** Участок стены, видимый игроку (обрезан по границам клеток). */
export interface WallPiece {
  id: string;
  kind: Wall['kind'];
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const EPS = 1e-6;

function cellSeen(cx: number, cy: number, visible: Set<string>, hidden: Set<string>): boolean {
  const key = areaCellKey(cx, cy);
  return visible.has(key) && !hidden.has(key);
}

/**
 * Видна ли точка стены игроку: для линии по границе клеток достаточно видимой
 * клетки с любой стороны, для диагонали — клетки, внутри которой она лежит.
 * Туман (`hidden`) скрывает клетку, даже если обзор её формально видит.
 */
export function wallPointVisible(
  x: number,
  y: number,
  visible: Set<string>,
  hidden: Set<string>,
  grid: WallGrid
): boolean {
  const size = grid.size;
  if (!(size > 0)) return false;
  const fx = (x - grid.offsetX) / size;
  const fy = (y - grid.offsetY) / size;
  const onX = Math.abs(fx - Math.round(fx)) < EPS;
  const onY = Math.abs(fy - Math.round(fy)) < EPS;
  const cx = Math.floor(fx + EPS);
  const cy = Math.floor(fy + EPS);
  if (onX && onY) {
    return (
      cellSeen(cx - 1, cy - 1, visible, hidden) ||
      cellSeen(cx, cy - 1, visible, hidden) ||
      cellSeen(cx - 1, cy, visible, hidden) ||
      cellSeen(cx, cy, visible, hidden)
    );
  }
  if (onX) return cellSeen(cx - 1, cy, visible, hidden) || cellSeen(cx, cy, visible, hidden);
  if (onY) return cellSeen(cx, cy - 1, visible, hidden) || cellSeen(cx, cy, visible, hidden);
  return cellSeen(cx, cy, visible, hidden);
}

/**
 * Стены карты, которые игрок видит сейчас: сегменты режутся по линиям сетки,
 * и остаются только участки, у которых видима соседняя (или содержащая) клетка.
 * Двери сюда не входят — у них свой рендер.
 */
export function visibleWallPieces(
  walls: Wall[],
  visible: Set<string>,
  hidden: Set<string>,
  grid: WallGrid
): WallPiece[] {
  const size = grid.size;
  if (!(size > 0) || visible.size === 0) return [];
  const pieces: WallPiece[] = [];
  for (const wall of walls) {
    if (wall.kind === 'door') continue;
    const dx = wall.x2 - wall.x1;
    const dy = wall.y2 - wall.y1;
    if (Math.abs(dx) < EPS && Math.abs(dy) < EPS) continue;
    const cuts = new Set<number>([0, 1]);
    const cutAxis = (from: number, to: number, start: number, delta: number, offset: number) => {
      if (Math.abs(delta) < EPS) return;
      const lo = Math.min(from, to) - offset;
      const hi = Math.max(from, to) - offset;
      for (let k = Math.ceil(lo / size); k <= Math.floor(hi / size); k++) {
        const t = (offset + k * size - start) / delta;
        if (t > EPS && t < 1 - EPS) cuts.add(t);
      }
    };
    cutAxis(wall.x1, wall.x2, wall.x1, dx, grid.offsetX);
    cutAxis(wall.y1, wall.y2, wall.y1, dy, grid.offsetY);
    const ts = [...cuts].sort((a, b) => a - b);
    for (let i = 0; i < ts.length - 1; i++) {
      const t0 = ts[i]!;
      const t1 = ts[i + 1]!;
      if (t1 - t0 < EPS) continue;
      const tm = (t0 + t1) / 2;
      if (!wallPointVisible(wall.x1 + dx * tm, wall.y1 + dy * tm, visible, hidden, grid)) continue;
      pieces.push({
        id: `${wall.id}:${i}`,
        kind: wall.kind,
        x1: wall.x1 + dx * t0,
        y1: wall.y1 + dy * t0,
        x2: wall.x1 + dx * t1,
        y2: wall.y1 + dy * t1,
      });
    }
  }
  return pieces;
}
