import { crossesWalls, type Sense, type Token, type Wall } from 'shared';

export interface Viewer {
  x: number;
  y: number;
  /** Радиусы в клетках; `null` — без ограничения (весь уровень). */
  radii: (number | null)[];
}

export interface VisionInput {
  width: number;
  height: number;
  /** Клетки тумана: размер и сдвиг (вижн считается по ним же). */
  cellSize: number;
  offsetX: number;
  offsetY: number;
  walls: Wall[];
  viewers: Viewer[];
}

/**
 * Радиусы зрения в клетках: вне «Темноты» — без предела, в темноте — по типам восприятия
 * (тёмное/слепое/дьявольское зрение), без них — 1 клетка вокруг.
 */
export function visionRadii(darkness: boolean, senses: Sense[]): (number | null)[] {
  if (!darkness) return [null];
  const radii = senses.map((s) => Math.floor(Math.max(0, s.range) / 5)).filter((r) => r > 0);
  return radii.length > 0 ? radii : [1];
}

/** Зрители обзора партии: токены с галкой «токен игрока». */
export function partyViewers(tokens: Token[], darkness: boolean): Viewer[] {
  return tokens
    .filter((t) => t.isPlayerToken)
    .map((t) => ({ x: t.x, y: t.y, radii: visionRadii(darkness, t.senses ?? []) }));
}

/**
 * Видимые клетки (ключи `cx,cy`, как у тумана) объединением по всем зрителям.
 * Радиусы — клеточные (Чёбышёв: «1 клетка вокруг» = 3×3), стены и закрытые двери
 * блокируют любой тип зрения (режим `sight`). Нет зрителей — null (без затемнения).
 */
export function visibleCells(input: VisionInput): Set<string> | null {
  const { width, height, cellSize, offsetX, offsetY, walls, viewers } = input;
  if (viewers.length === 0) return null;
  const cols = Math.max(0, Math.ceil(width / cellSize));
  const rows = Math.max(0, Math.ceil(height / cellSize));
  const visible = new Set<string>();
  for (const viewer of viewers) {
    for (const radius of viewer.radii) {
      const vcx = Math.floor((viewer.x - offsetX) / cellSize);
      const vcy = Math.floor((viewer.y - offsetY) / cellSize);
      const cx0 = radius === null ? 0 : Math.max(0, vcx - radius);
      const cx1 = radius === null ? cols - 1 : Math.min(cols - 1, vcx + radius);
      const cy0 = radius === null ? 0 : Math.max(0, vcy - radius);
      const cy1 = radius === null ? rows - 1 : Math.min(rows - 1, vcy + radius);
      for (let cx = cx0; cx <= cx1; cx++) {
        for (let cy = cy0; cy <= cy1; cy++) {
          const key = `${cx},${cy}`;
          if (visible.has(key)) continue;
          if (radius !== null && Math.max(Math.abs(cx - vcx), Math.abs(cy - vcy)) > radius) continue;
          const center = {
            x: offsetX + cx * cellSize + cellSize / 2,
            y: offsetY + cy * cellSize + cellSize / 2,
          };
          if (crossesWalls({ x: viewer.x, y: viewer.y }, center, walls, 'sight')) continue;
          visible.add(key);
        }
      }
    }
  }
  return visible;
}
