import {
  areaCellKey,
  crossesWalls,
  isBanished,
  pointCell,
  rectCrossesWalls,
  tokenCells,
  wallsWithZones,
  type Token,
  type Wall,
} from 'shared';
import type { Room } from '../roomTypes';

/**
 * Геометрия обмена местами для Приманки и подмены: одинаковые подошвы меняются
 * как есть, смешанные (1×1 ↔ 2×2) — по минимальному суммарному сдвигу без пересечений.
 */

export interface SwapPlan {
  token: { x: number; y: number };
  target: { x: number; y: number };
}

/** Предел сдвига при смешанном обмене: 2 клетки (10 фт) на токен. */
const MAX_MIXED_SHIFT_CELLS = 2;

export function sameFootprint(a: Token, b: Token): boolean {
  return a.cells === b.cells && a.w === b.w && a.h === b.h;
}

/** Валидные якоря сетки для размера: нечётные — центры клеток, чётные — пересечения. */
function anchorLattice(
  cells: number,
  grid: { size: number; offsetX: number; offsetY: number },
  around: { x: number; y: number },
  radius: number
): { x: number; y: number }[] {
  const base = cells % 2 === 1 ? grid.size / 2 : 0;
  const kx = Math.round((around.x - grid.offsetX - base) / grid.size);
  const ky = Math.round((around.y - grid.offsetY - base) / grid.size);
  const out: { x: number; y: number }[] = [];
  for (let x = kx - radius; x <= kx + radius; x++) {
    for (let y = ky - radius; y <= ky + radius; y++) {
      out.push({ x: grid.offsetX + base + x * grid.size, y: grid.offsetY + base + y * grid.size });
    }
  }
  return out;
}

function cellsAt(
  token: Token,
  pos: { x: number; y: number },
  grid: { size: number; offsetX: number; offsetY: number }
): string[] {
  return tokenCells({ x: pos.x, y: pos.y, w: token.w, h: token.h }, grid);
}

function placementFits(
  token: Token,
  pos: { x: number; y: number },
  occupied: Set<string>,
  map: { width: number; height: number },
  grid: { size: number; offsetX: number; offsetY: number },
  walls: Wall[]
): boolean {
  const x0 = pos.x - token.w / 2;
  const y0 = pos.y - token.h / 2;
  if (map.width > 0 && (x0 < 0 || y0 < 0 || x0 + token.w > map.width || y0 + token.h > map.height)) {
    return false;
  }
  if (cellsAt(token, pos, grid).some((key) => occupied.has(key))) return false;
  // Стена внутри подошвы запрещает постановку (касание краем — разрешено).
  const inset = 1;
  const rect = {
    x: x0 + inset,
    y: y0 + inset,
    w: Math.max(1, token.w - inset * 2),
    h: Math.max(1, token.h - inset * 2),
  };
  return !rectCrossesWalls(rect, walls, 'move');
}

function chebCells(from: { x: number; y: number }, to: { x: number; y: number }, step: number): number {
  return Math.max(Math.abs(from.x - to.x), Math.abs(from.y - to.y)) / step;
}

function shiftFeet(from: { x: number; y: number }, to: { x: number; y: number }, step: number): number {
  return (Math.hypot(from.x - to.x, from.y - to.y) / step) * 5;
}

function keyLess(a: number[], b: number[]): boolean {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return (a[i] ?? 0) < (b[i] ?? 0);
  }
  return false;
}

/**
 * Смешанный обмен (например, 1×1 ↔ 2×2): большой встаёт валидным якорем,
 * накрывающим старую клетку меньшего; меньший — в свободные клетки старой
 * области большого. Из допустимых пар выбираем минимальный суммарный сдвиг.
 */
export function mixedSwapPlan(
  map: Room['scene']['maps'][number],
  grid: { size: number; offsetX: number; offsetY: number },
  a: Token,
  b: Token
): SwapPlan | null {
  const area = (t: Token) => t.w * t.h;
  const [larger, smaller] =
    a.cells !== b.cells
      ? a.cells > b.cells
        ? [a, b]
        : [b, a]
      : area(a) >= area(b)
        ? [a, b]
        : [b, a];
  const walls = wallsWithZones(map.walls, map.zones, grid);
  const occupied = new Set<string>();
  for (const t of map.tokens) {
    if (t.id === a.id || t.id === b.id || isBanished(t)) continue;
    for (const key of tokenCells(t, grid)) occupied.add(key);
  }
  const smallCell = pointCell(smaller, grid);
  const smallKey = areaCellKey(smallCell.cx, smallCell.cy);
  const oldLargeCells = new Set(tokenCells(larger, grid));
  const radius = Math.max(2, larger.cells + 1);

  const largeCands: { pos: { x: number; y: number }; cells: string[] }[] = [];
  for (const pos of anchorLattice(larger.cells, grid, smaller, radius)) {
    const cells = cellsAt(larger, pos, grid);
    if (!cells.includes(smallKey)) continue;
    if (chebCells(larger, pos, grid.size) > MAX_MIXED_SHIFT_CELLS) continue;
    if (crossesWalls(larger, pos, walls, 'move')) continue;
    if (!placementFits(larger, pos, occupied, map, grid, walls)) continue;
    largeCands.push({ pos, cells });
  }
  const smallCands: { pos: { x: number; y: number }; cells: string[] }[] = [];
  for (const pos of anchorLattice(smaller.cells, grid, larger, radius)) {
    const cells = cellsAt(smaller, pos, grid);
    if (!cells.length || !cells.every((key) => oldLargeCells.has(key))) continue;
    if (chebCells(smaller, pos, grid.size) > MAX_MIXED_SHIFT_CELLS) continue;
    if (crossesWalls(smaller, pos, walls, 'move')) continue;
    if (!placementFits(smaller, pos, occupied, map, grid, walls)) continue;
    smallCands.push({ pos, cells });
  }

  let best: { large: { x: number; y: number }; small: { x: number; y: number } } | null = null;
  let bestKey: number[] | null = null;
  for (const lc of largeCands) {
    for (const sc of smallCands) {
      if (lc.cells.some((key) => sc.cells.includes(key))) continue;
      const lf = shiftFeet(larger, lc.pos, grid.size);
      const sf = shiftFeet(smaller, sc.pos, grid.size);
      // Сначала бережём большой токен (меньше сдвиг), затем — меньший.
      const key = [lf, sf, lf + sf, lc.pos.x, lc.pos.y, sc.pos.x, sc.pos.y];
      if (!bestKey || keyLess(key, bestKey)) {
        bestKey = key;
        best = { large: lc.pos, small: sc.pos };
      }
    }
  }
  if (!best) return null;
  return a === larger ? { token: best.large, target: best.small } : { token: best.small, target: best.large };
}
