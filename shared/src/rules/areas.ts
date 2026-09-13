import type { AreaSpec, Token } from '../types';

/**
 * Геометрия областей (Ф7) на квадратной сетке: набор клеток шаблона и сбор
 * попавших существ. Общая для клиента (подсветка) и сервера (применение).
 */

export const FEET_PER_CELL = 5;

export interface AreaGrid {
  size: number;
  offsetX: number;
  offsetY: number;
}

export interface AreaPoint {
  x: number;
  y: number;
}

export type DistanceMetric = 'euclidean' | 'chebyshev';

/** Клетка, в которой лежит точка. */
export function pointCell(p: AreaPoint, grid: AreaGrid): { cx: number; cy: number } {
  return {
    cx: Math.floor((p.x - grid.offsetX) / grid.size),
    cy: Math.floor((p.y - grid.offsetY) / grid.size),
  };
}

/** Центр клетки в мировых координатах. */
export function cellCenter(cx: number, cy: number, grid: AreaGrid): AreaPoint {
  return {
    x: grid.offsetX + (cx + 0.5) * grid.size,
    y: grid.offsetY + (cy + 0.5) * grid.size,
  };
}

export function areaCellKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

/** Занимаемые токеном клетки (по ограничивающему прямоугольнику). */
export function tokenCells(token: Pick<Token, 'x' | 'y' | 'w' | 'h'>, grid: AreaGrid): string[] {
  const x0 = token.x - token.w / 2;
  const y0 = token.y - token.h / 2;
  const cx0 = Math.floor((x0 - grid.offsetX) / grid.size);
  const cy0 = Math.floor((y0 - grid.offsetY) / grid.size);
  const cx1 = Math.floor((x0 + token.w - 1e-3 - grid.offsetX) / grid.size);
  const cy1 = Math.floor((y0 + token.h - 1e-3 - grid.offsetY) / grid.size);
  const cells: string[] = [];
  for (let cx = cx0; cx <= cx1; cx++) {
    for (let cy = cy0; cy <= cy1; cy++) cells.push(areaCellKey(cx, cy));
  }
  return cells;
}

/** Расстояние между точками в футах по выбранной метрике. */
function feet(a: AreaPoint, b: AreaPoint, grid: AreaGrid, metric: DistanceMetric): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const px = metric === 'chebyshev' ? Math.max(Math.abs(dx), Math.abs(dy)) : Math.hypot(dx, dy);
  return (px / grid.size) * FEET_PER_CELL;
}

/**
 * Клетки, попавшие в шаблон. `origin` — точка привязки (для конуса/линии —
 * вершина), `direction` — направление для конуса/линии (мировая точка).
 */
export function areaCells(
  spec: AreaSpec,
  origin: AreaPoint,
  direction: AreaPoint | null,
  grid: AreaGrid,
  metric: DistanceMetric = 'euclidean'
): string[] {
  const originCell = pointCell(origin, grid);
  const center = cellCenter(originCell.cx, originCell.cy, grid);
  const span = Math.ceil((spec.size + (spec.width ?? 0)) / FEET_PER_CELL) + 2;
  const keys: string[] = [];

  const dir =
    direction && (direction.x !== center.x || direction.y !== center.y)
      ? (() => {
          const dx = direction.x - center.x;
          const dy = direction.y - center.y;
          const len = Math.hypot(dx, dy);
          return { x: dx / len, y: dy / len };
        })()
      : null;

  for (let cx = originCell.cx - span; cx <= originCell.cx + span; cx++) {
    for (let cy = originCell.cy - span; cy <= originCell.cy + span; cy++) {
      const p = cellCenter(cx, cy, grid);
      const vx = p.x - center.x;
      const vy = p.y - center.y;
      const distanceFeet = feet(p, center, grid, 'euclidean');
      let inside = false;

      switch (spec.shape) {
        case 'sphere':
        case 'cylinder': {
          const d = metric === 'chebyshev' ? Math.max(Math.abs(vx), Math.abs(vy)) : Math.hypot(vx, vy);
          inside = (d / grid.size) * FEET_PER_CELL <= spec.size + 1e-6;
          break;
        }
        case 'cube': {
          const half = (spec.size / 2 / FEET_PER_CELL) * grid.size;
          inside = Math.abs(vx) <= half + 1e-6 && Math.abs(vy) <= half + 1e-6;
          break;
        }
        case 'cone': {
          if (!dir) break;
          const lengthPx = (spec.size / FEET_PER_CELL) * grid.size;
          const proj = vx * dir.x + vy * dir.y;
          if (proj < -1e-6 || distanceFeet > spec.size + 1e-6) break;
          const unit = distanceFeet > 0 ? { x: vx / Math.hypot(vx, vy), y: vy / Math.hypot(vx, vy) } : dir;
          const cos = unit.x * dir.x + unit.y * dir.y;
          inside = cos >= Math.cos((53 / 2) * (Math.PI / 180)) - 1e-6 && proj <= lengthPx + 1e-6;
          break;
        }
        case 'line': {
          if (!dir) break;
          const lengthPx = (spec.size / FEET_PER_CELL) * grid.size;
          const halfWidthPx = ((spec.width ?? 5) / 2 / FEET_PER_CELL) * grid.size;
          const proj = vx * dir.x + vy * dir.y;
          if (proj < -1e-6 || proj > lengthPx + 1e-6) break;
          const perp = Math.abs(vx * dir.y - vy * dir.x);
          inside = perp <= halfWidthPx + 1e-6;
          break;
        }
      }

      if (inside) keys.push(areaCellKey(cx, cy));
    }
  }

  if (!keys.includes(areaCellKey(originCell.cx, originCell.cy))) {
    // Вершина всегда часть шаблона.
    keys.push(areaCellKey(originCell.cx, originCell.cy));
  }
  return keys;
}

/** Существа, у которых хотя бы одна занятая клетка попала в шаблон. */
export function tokensInArea<S extends Pick<Token, 'x' | 'y' | 'w' | 'h'>>(
  tokens: S[],
  spec: AreaSpec,
  origin: AreaPoint,
  direction: AreaPoint | null,
  grid: AreaGrid,
  metric: DistanceMetric = 'euclidean'
): S[] {
  const cells = new Set(areaCells(spec, origin, direction, grid, metric));
  return tokens.filter((t) => tokenCells(t, grid).some((key) => cells.has(key)));
}
