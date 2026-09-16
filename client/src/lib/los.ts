import {
  areaCellKey,
  areaKindAt,
  crossesWalls,
  strongestKind,
  visionRadiiCells,
  zoneVisionCells,
  type LightArea,
  type LightAreaKind,
  type Token,
  type Wall,
  type ZoneInstance,
} from 'shared';

export interface Viewer {
  x: number;
  y: number;
  senses: Token['senses'];
}

export interface VisionInput {
  width: number;
  height: number;
  /** Клетки тумана: размер и сдвиг (вижн считается по ним же). */
  cellSize: number;
  offsetX: number;
  offsetY: number;
  walls: Wall[];
  darkness: boolean;
  areas: LightArea[];
  /** Активные зоны заклинаний (вижн по флагам). */
  zones: ZoneInstance[];
  viewers: Viewer[];
}

/** Зрители обзора: объединение всех токенов игроков либо только свои (флаг «Объединять обзор игроков»). */
export function visionViewers(tokens: Token[], merge: boolean, isOwn: (token: Token) => boolean): Viewer[] {
  const party = tokens.filter((t) => t.isPlayerToken);
  const own = party.filter(isOwn);
  const use = merge || own.length === 0 ? party : own;
  return use.map((t) => ({ x: t.x, y: t.y, senses: t.senses ?? [] }));
}

/**
 * Видимые клетки (ключи `cx,cy`, как у тумана) объединением по всем зрителям.
 * Стены и закрытые двери блокируют; тьма (глобальная «Темнота» или области)
 * ограничивает дальность по восприятию (Чёбышёв по клеткам). Нет зрителей — null.
 */
export function visibleCells(input: VisionInput): Set<string> | null {
  const { width, height, cellSize, offsetX, offsetY, walls, darkness, areas, zones, viewers } = input;
  if (viewers.length === 0) return null;
  const cols = Math.max(0, Math.ceil(width / cellSize));
  const rows = Math.max(0, Math.ceil(height / cellSize));
  const zoneCells = zoneVisionCells(zones, { size: cellSize, offsetX, offsetY });
  const visible = new Set<string>();
  for (const viewer of viewers) {
    const vcx = Math.floor((viewer.x - offsetX) / cellSize);
    const vcy = Math.floor((viewer.y - offsetY) / cellSize);
    const viewerKind = strongestKind(
      areaKindAt(areas, { x: viewer.x, y: viewer.y }),
      zoneCells.get(areaCellKey(vcx, vcy)) ?? null
    );
    const radiiByKind = new Map<LightAreaKind | null, (number | null)[]>();
    const radiiFor = (kind: LightAreaKind | null): (number | null)[] => {
      let radii = radiiByKind.get(kind);
      if (!radii) {
        radii = visionRadiiCells(darkness, viewer.senses, kind);
        radiiByKind.set(kind, radii);
      }
      return radii;
    };
    for (let cx = 0; cx < cols; cx++) {
      for (let cy = 0; cy < rows; cy++) {
        const key = `${cx},${cy}`;
        if (visible.has(key)) continue;
        const center = {
          x: offsetX + cx * cellSize + cellSize / 2,
          y: offsetY + cy * cellSize + cellSize / 2,
        };
        if (crossesWalls({ x: viewer.x, y: viewer.y }, center, walls, 'sight')) continue;
        const kind = strongestKind(viewerKind, strongestKind(areaKindAt(areas, center), zoneCells.get(key) ?? null));
        if (!kind && !darkness) {
          visible.add(key);
          continue;
        }
        const distance = Math.max(Math.abs(cx - vcx), Math.abs(cy - vcy));
        if (radiiFor(kind).some((r) => r === null || distance <= r)) visible.add(key);
      }
    }
  }
  return visible;
}
