import { crossesWalls, type Token, type Wall } from 'shared';

export interface Viewer {
  x: number;
  y: number;
  /** Радиус в клетках; null — без ограничения (весь уровень). */
  radius: number | null;
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

/** Радиус зрения в клетках: вне «Темноты» — без предела, в темноте — тёмное зрение, без него 1 клетка. */
export function visionRadiusCells(darkvisionFt: number, darkness: boolean): number | null {
  if (!darkness) return null;
  const cells = Math.floor(Math.max(0, darkvisionFt) / 5);
  return cells > 0 ? cells : 1;
}

/** Зрители обзора партии: токены с галкой «токен игрока». */
export function partyViewers(tokens: Token[], darkness: boolean): Viewer[] {
  return tokens
    .filter((t) => t.isPlayerToken)
    .map((t) => ({ x: t.x, y: t.y, radius: visionRadiusCells(t.darkvision, darkness) }));
}

/**
 * Видимые клетки (ключи `cx,cy`, как у тумана) объединением по всем зрителям.
 * Дальность — радиус Чёбышёва в клетках («1 клетка вокруг» = 3×3),
 * стены и закрытые двери блокируют (режим `sight`). Нет зрителей — null (без затемнения).
 */
export function visibleCells(input: VisionInput): Set<string> | null {
  const { width, height, cellSize, offsetX, offsetY, walls, viewers } = input;
  if (viewers.length === 0) return null;
  const cols = Math.max(0, Math.ceil(width / cellSize));
  const rows = Math.max(0, Math.ceil(height / cellSize));
  const visible = new Set<string>();
  for (const viewer of viewers) {
    const vcx = Math.floor((viewer.x - offsetX) / cellSize);
    const vcy = Math.floor((viewer.y - offsetY) / cellSize);
    const r = viewer.radius;
    const cx0 = r === null ? 0 : Math.max(0, vcx - r);
    const cx1 = r === null ? cols - 1 : Math.min(cols - 1, vcx + r);
    const cy0 = r === null ? 0 : Math.max(0, vcy - r);
    const cy1 = r === null ? rows - 1 : Math.min(rows - 1, vcy + r);
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cy = cy0; cy <= cy1; cy++) {
        const key = `${cx},${cy}`;
        if (visible.has(key)) continue;
        if (r !== null && Math.max(Math.abs(cx - vcx), Math.abs(cy - vcy)) > r) continue;
        const center = {
          x: offsetX + cx * cellSize + cellSize / 2,
          y: offsetY + cy * cellSize + cellSize / 2,
        };
        if (crossesWalls({ x: viewer.x, y: viewer.y }, center, walls, 'sight')) continue;
        visible.add(key);
      }
    }
  }
  return visible;
}
