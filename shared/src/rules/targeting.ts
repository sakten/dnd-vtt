import type { Wall } from '../domain/scene';
import type { Token } from '../domain/token';
import { areaCellKey, cellCenter, cellChebyshev, tokenCells, tokenVisibleFrom, type AreaGrid } from './areas';
import { gridDistanceFeet } from './combat';
import { isBanished } from './effects';
import { crossesWalls } from './walls';

/**
 * Правила выбора целей, общие для клиента (подсветка/блокировка клика) и сервера
 * (авторитетная валидация): дистанция, путь до цели, клетки телепорта рядом с целью.
 */

/** Проблема цели-существа: вне дистанции или нет чистого пути; undefined — можно. */
export function creatureTargetIssue(
  caster: Token,
  target: Token,
  walls: Wall[],
  grid: AreaGrid,
  rangeFeet: number
): { code: 'outOfRange'; feet: number } | { code: 'noClearPath' } | undefined {
  const feet = gridDistanceFeet(caster, target, grid.size);
  if (feet > rangeFeet) return { code: 'outOfRange', feet };
  if (!tokenVisibleFrom(caster, target, walls, grid)) return { code: 'noClearPath' };
  return undefined;
}

/** Ближайшая к точке цель (Steel Wind Strike): якорь проверки телепорта. */
export function nearestTarget<T extends Pick<Token, 'x' | 'y'>>(
  origin: { x: number; y: number },
  targets: readonly T[]
): T | undefined {
  let best: T | undefined;
  let bestFeet = Infinity;
  for (const target of targets) {
    const feet = Math.hypot(origin.x - target.x, origin.y - target.y);
    if (feet < bestFeet) {
      best = target;
      bestFeet = feet;
    }
  }
  return best;
}

/**
 * Допуск пассажира телепорта (Dimension Door, Thunder Step): существо рядом в
 * момент каста и (для Thunder Step) не крупнее кастера. undefined — можно.
 */
export function passengerIssue(
  caster: Token,
  target: Token,
  grid: AreaGrid,
  plan: { feet: number; maxSize?: boolean }
): { code: 'outOfRange'; feet: number } | { code: 'passengerTooLarge' } | undefined {
  const feet = gridDistanceFeet(caster, target, grid.size);
  if (feet > plan.feet) return { code: 'outOfRange', feet };
  if (plan.maxSize && (target.w > caster.w || target.h > caster.h)) return { code: 'passengerTooLarge' };
  return undefined;
}

/**
 * Дистанция от клетки до подошвы цели по правилам сетки: своя и любая соседняя
 * клетка (в т.ч. по диагонали) — 5 фт, следующая — 10 фт и т.д. Так «рядом»
 * одинаково работает для маленьких и больших существ.
 */
export function cellNearTargetFeet(
  cx: number,
  cy: number,
  target: Pick<Token, 'x' | 'y' | 'w' | 'h'>,
  grid: AreaGrid
): number {
  let best = Infinity;
  for (const key of tokenCells(target, grid)) {
    const [tx, ty] = key.split(',').map(Number);
    if (tx === undefined || ty === undefined) continue;
    best = Math.min(best, cellChebyshev({ cx, cy }, { cx: tx, cy: ty }));
  }
  return Number.isFinite(best) ? Math.max(5, best * 5) : Infinity;
}

/**
 * Клетки, куда можно телепортироваться после атак (Steel Wind Strike): в `feet`
 * от подошвы любой из целей по сетке, свободные (кроме перемещаемого), с чистым
 * путём от цели. Без границ карты — их отсекает вызывающий.
 */
export function teleportCellsNearTargets(
  targets: readonly Token[],
  tokens: readonly Token[],
  grid: AreaGrid,
  walls: Wall[],
  feet: number,
  moverId: string
): string[] {
  return teleportCellsNearBoxes(
    targets.filter((t) => !isBanished(t)),
    tokens,
    grid,
    walls,
    feet,
    moverId
  );
}

/** То же от произвольных прямоугольников-якорей (точка прибытия Dimension Door). */
export function teleportCellsNearBoxes(
  anchors: readonly Pick<Token, 'x' | 'y' | 'w' | 'h'>[],
  tokens: readonly Token[],
  grid: AreaGrid,
  walls: Wall[],
  feet: number,
  moverId: string
): string[] {
  const occupied = new Set(
    tokens.filter((t) => t.id !== moverId && !isBanished(t)).flatMap((t) => tokenCells(t, grid))
  );
  const radiusCells = Math.max(1, Math.ceil(feet / 5));
  const out = new Set<string>();
  for (const anchor of anchors) {
    // Перебираем вокруг каждой клетки подошвы (большие цели занимают несколько).
    for (const key of tokenCells(anchor, grid)) {
      const [tx, ty] = key.split(',').map(Number);
      if (tx === undefined || ty === undefined) continue;
      for (let cx = tx - radiusCells; cx <= tx + radiusCells; cx++) {
        for (let cy = ty - radiusCells; cy <= ty + radiusCells; cy++) {
          const cell = areaCellKey(cx, cy);
          if (occupied.has(cell) || out.has(cell)) continue;
          if (cellNearTargetFeet(cx, cy, anchor, grid) > feet) continue;
          if (crossesWalls(anchor, cellCenter(cx, cy, grid), walls, 'sight')) continue;
          out.add(cell);
        }
      }
    }
  }
  return [...out];
}
