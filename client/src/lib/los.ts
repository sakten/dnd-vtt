import {
  canSee,
  crossesWalls,
  strongestKind,
  tokenSenses,
  visionKindAt,
  visionRadiiCells,
  zoneVisionCells,
  type LightAreaKind,
  type SightContext,
  type Token,
} from 'shared';

export interface Viewer {
  x: number;
  y: number;
  senses: Token['senses'];
}

/** Контекст обзора (стены/тьма/области/зоны) + границы расчёта и зрители. */
export interface VisionInput extends SightContext {
  width: number;
  height: number;
  /** Границы расчёта в клетках (вьюпорт ∩ карта); без значения — вся карта. */
  bounds?: { cx0: number; cy0: number; cx1: number; cy1: number } | null;
  viewers: Viewer[];
}

/** Зрители обзора: объединение всех токенов игроков либо только свои (флаг «Объединять обзор игроков»). */
export function visionViewers(tokens: Token[], merge: boolean, isOwn: (token: Token) => boolean): Viewer[] {
  const party = tokens.filter((t) => t.isPlayerToken);
  const own = party.filter(isOwn);
  const use = merge || own.length === 0 ? party : own;
  return use.map((t) => ({ x: t.x, y: t.y, senses: tokenSenses(t) }));
}

/**
 * Можно ли войти в клетку (по её центру): видна любому зрителю **или** лежит во
 * тьме/мгле — туда заходят вслепую (ты внутри области видишь только свою клетку).
 */
export function enterableCell(sight: SightContext, viewers: Viewer[], center: { x: number; y: number }): boolean {
  if (visionKindAt(sight, center) !== null) return true;
  return viewers.some((v) => canSee({ x: v.x, y: v.y }, center, v.senses, sight));
}

/**
 * Видимые клетки (ключи `cx,cy`, как у тумана) объединением по всем зрителям.
 * Стены и закрытые двери блокируют; тьма (глобальная «Темнота» или области)
 * ограничивает дальность по восприятию (Чёбышёв по клеткам). Нет зрителей — null.
 */
export function visibleCells(input: VisionInput): Set<string> | null {
  const { width, height, cellSize, offsetX, offsetY, walls, darkness, bounds, viewers } = input;
  const areas = input.areas ?? [];
  const zones = input.zones ?? [];
  if (viewers.length === 0) return null;
  const cols = Math.max(0, Math.ceil(width / cellSize));
  const rows = Math.max(0, Math.ceil(height / cellSize));
  const cx0 = Math.max(0, bounds?.cx0 ?? 0);
  const cy0 = Math.max(0, bounds?.cy0 ?? 0);
  const cx1 = Math.min(cols - 1, bounds?.cx1 ?? cols - 1);
  const cy1 = Math.min(rows - 1, bounds?.cy1 ?? rows - 1);
  const zoneCells = zoneVisionCells(zones, { size: cellSize, offsetX, offsetY }, walls);
  const sight = { areas, zones, zoneCells, cellSize, offsetX, offsetY, walls };
  const visible = new Set<string>();
  for (const viewer of viewers) {
    const vcx = Math.floor((viewer.x - offsetX) / cellSize);
    const vcy = Math.floor((viewer.y - offsetY) / cellSize);
    const viewerKind = visionKindAt(sight, { x: viewer.x, y: viewer.y });
    const radiiByKind = new Map<LightAreaKind | null, (number | null)[]>();
    const radiiFor = (kind: LightAreaKind | null): (number | null)[] => {
      let radii = radiiByKind.get(kind);
      if (!radii) {
        radii = visionRadiiCells(darkness, viewer.senses, kind);
        radiiByKind.set(kind, radii);
      }
      return radii;
    };
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cy = cy0; cy <= cy1; cy++) {
        const key = `${cx},${cy}`;
        if (visible.has(key)) continue;
        const center = {
          x: offsetX + cx * cellSize + cellSize / 2,
          y: offsetY + cy * cellSize + cellSize / 2,
        };
        if (crossesWalls({ x: viewer.x, y: viewer.y }, center, walls, 'sight')) continue;
        const kind = strongestKind(viewerKind, visionKindAt(sight, center));
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
