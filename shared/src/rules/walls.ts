import type { Wall } from '../domain/scene';

export interface Point {
  x: number;
  y: number;
}

const EPS = 1e-6;

function orient(p: Point, q: Point, r: Point): number {
  return (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
}

function sign(v: number): number {
  return v > EPS ? 1 : v < -EPS ? -1 : 0;
}

function onSegment(p: Point, q: Point, r: Point): boolean {
  return (
    Math.min(p.x, q.x) - EPS <= r.x &&
    r.x <= Math.max(p.x, q.x) + EPS &&
    Math.min(p.y, q.y) - EPS <= r.y &&
    r.y <= Math.max(p.y, q.y) + EPS
  );
}

/**
 * Пересечение отрезков; касание концом/точкой считается пересечением —
 * «протиснуться» в нулевую щель на стыке стен нельзя.
 */
export function segmentsIntersect(p1: Point, p2: Point, q1: Point, q2: Point): boolean {
  const o1 = sign(orient(p1, p2, q1));
  const o2 = sign(orient(p1, p2, q2));
  const o3 = sign(orient(q1, q2, p1));
  const o4 = sign(orient(q1, q2, p2));
  if (o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0) return o1 !== o2 && o3 !== o4;
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, p2, q2)) return true;
  if (o3 === 0 && onSegment(q1, q2, p1)) return true;
  if (o4 === 0 && onSegment(q1, q2, p2)) return true;
  return false;
}

/** Режим проверки: `sight` — обзор, `move` — проход. */
export type WallCheckMode = 'sight' | 'move';

/** Блокирует ли стена проход/обзор в данном режиме (закрытая дверь — да, открытая — нет). */
function blocks(w: Wall, mode: WallCheckMode): boolean {
  if (w.kind === 'wall') return true;
  if (w.kind === 'door') return !w.open;
  return mode === 'move';
}

/** Пересекает ли отрезок a→b хотя бы одну блокирующую стену (по умолчанию — для обзора). */
export function crossesWalls(a: Point, b: Point, walls: Wall[], mode: WallCheckMode = 'sight'): boolean {
  return walls.some(
    (w) => blocks(w, mode) && segmentsIntersect(a, b, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 })
  );
}
