import type { Wall } from '../domain/scene';
import type { Token } from '../domain/token';
import { areaCellKey, cellChebyshev, tokenCells, type AreaGrid } from './areas';
import { hostileTokens } from './combat';
import { isIncapacitated } from './conditions';
import { isBanished } from './effects';
import { rectCrossesWalls } from './walls';

/**
 * Опциональное правило «Окружение» (DM, per-room): если все свободные клетки
 * вокруг существа контролируют смежные враги и их больше одного, эти враги
 * атакуют его с преимуществом. Смежный враг контролирует свою подошву и клетки
 * вокруг себя; рич контроля не расширяет; стены/закрытые двери/вне карты —
 * не клетки контроля; союзник рядом ломает окружение. Диагонали считаются.
 */

/** Маркер авто-состояния «Окружён» (снимается правилом, ручные не трогаем). */
export const SURROUNDED_SOURCE = 'rule:surrounded';
export const SURROUNDED_NAME = 'Окружён';

type CellToken = Pick<Token, 'id' | 'x' | 'y' | 'w' | 'h' | 'faction' | 'conditions' | 'effects'>;

export interface SurroundedInput {
  target: CellToken;
  tokens: CellToken[];
  grid: AreaGrid;
  walls?: Wall[];
  /** Границы карты в px; клетки вне не учитываются. */
  bounds?: { width: number; height: number };
}

function parseKey(key: string): { cx: number; cy: number } {
  const [cx, cy] = key.split(',').map(Number);
  return { cx: cx ?? 0, cy: cy ?? 0 };
}

function cellsSet(token: CellToken, grid: AreaGrid): { set: Set<string>; cells: { cx: number; cy: number }[] } {
  const cells = tokenCells(token, grid).map(parseKey);
  return { set: new Set(cells.map((c) => areaCellKey(c.cx, c.cy))), cells };
}

/** Окружено ли существо смежными врагами (правило DM). */
export function isSurrounded(input: SurroundedInput): boolean {
  const { target, tokens, grid, walls = [], bounds } = input;
  // Изгнанный (Banishment) вне поля — окружения нет.
  if (isBanished(target)) return false;
  const { set: targetCells, cells: targetList } = cellsSet(target, grid);
  if (!targetCells.size) return false;

  // Кольцо клеток вокруг подошвы цели.
  const neighbors = new Set<string>();
  for (const cell of targetList) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = areaCellKey(cell.cx + dx, cell.cy + dy);
        if (!targetCells.has(key)) neighbors.add(key);
      }
    }
  }

  const b = bounds && bounds.width > 0 && bounds.height > 0 ? bounds : null;
  const inBounds = (cx: number, cy: number) =>
    !b ||
    (grid.offsetX + cx * grid.size < b.width &&
      grid.offsetY + cy * grid.size < b.height &&
      grid.offsetX + (cx + 1) * grid.size > 0 &&
      grid.offsetY + (cy + 1) * grid.size > 0);

  const blocked = (cx: number, cy: number) =>
    walls.length > 0 &&
    rectCrossesWalls(
      { x: grid.offsetX + cx * grid.size, y: grid.offsetY + cy * grid.size, w: grid.size, h: grid.size },
      walls,
      'move'
    );

  const free = [...neighbors].map(parseKey).filter((c) => inBounds(c.cx, c.cy) && !blocked(c.cx, c.cy));
  if (!free.length) return false;

  // Кто стоит в клетке и где чья подошва (изгнанные — вне поля).
  const occupancy = new Map<string, CellToken>();
  for (const token of tokens) {
    if (token.id === target.id || isBanished(token)) continue;
    for (const key of tokenCells(token, grid)) if (!occupancy.has(key)) occupancy.set(key, token);
  }

  // Смежные враги: подошва в пределах 1 клетки от подошвы цели. Убитые и
  // недееспособные не угрожают и окружения не создают.
  const enemies = tokens.filter(
    (t) =>
      t.id !== target.id &&
      !isBanished(t) &&
      hostileTokens(target, t) &&
      !isIncapacitated(t.conditions) &&
      !t.conditions.some((c) => c.key === 'dead')
  );
  const adjacentEnemies = enemies.filter((t) =>
    tokenCells(t, grid).some((key) => {
      const cell = parseKey(key);
      return targetList.some((tc) => cellChebyshev(cell, tc) <= 1);
    })
  );
  if (adjacentEnemies.length < 2) return false;

  // Контроль: своя клетка + клетки вокруг себя (только смежные враги).
  const controlled = new Set<string>();
  for (const enemy of adjacentEnemies) {
    for (const key of tokenCells(enemy, grid)) {
      const cell = parseKey(key);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) controlled.add(areaCellKey(cell.cx + dx, cell.cy + dy));
      }
    }
  }
  const enemyIds = new Set(enemies.map((t) => t.id));

  for (const cell of free) {
    const key = areaCellKey(cell.cx, cell.cy);
    const occupant = occupancy.get(key);
    // Союзник/нейтрал в клетке — окружения нет; враг — клетка под контролем.
    if (occupant) {
      if (!enemyIds.has(occupant.id)) return false;
      continue;
    }
    if (!controlled.has(key)) return false;
  }
  return true;
}
