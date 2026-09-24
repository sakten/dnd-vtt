import {
  gridOfMap,
  isBanished,
  sideMatches,
  tokenFullyInArea,
  tokensInArea,
  type AreaSpec,
  type Token,
} from 'shared';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';

export interface AreaTokensOptions {
  /** Направление конуса/линии. */
  direction?: { x: number; y: number } | null;
  /** `fullyWithin` — токен целиком внутри области (иначе — любое пересечение). */
  containment?: 'anyCell' | 'fullyWithin';
  /** Кого не включать (кастер/носитель в своей же области). */
  excludeId?: string;
  /** Источник для `side`/`excludeSource` (ауры зон). */
  source?: Token;
  /** Аура действует только на враждебных/союзных источнику. */
  side?: 'hostile' | 'ally';
  /** Не включать сам источник. */
  excludeSource?: boolean;
}

/**
 * Токены в области от точки: единый сбор для каста заклинаний, действий и аур зон.
 * Геометрия — общая (`shared` `tokensInArea`/`tokenFullyInArea`), стен/двери учитываются.
 */
export function areaTokens(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  area: AreaSpec,
  origin: { x: number; y: number },
  opts: AreaTokensOptions = {}
): Token[] {
  const map = ctx.manager.findMap(room, mapId);
  if (!map) return [];
  const grid = gridOfMap(map, room.scene.grid);
  const direction = opts.direction ?? null;
  const inside =
    opts.containment === 'fullyWithin'
      ? map.tokens.filter((t) => tokenFullyInArea(t, area, origin, direction, grid, 'euclidean', map.walls))
      : tokensInArea(map.tokens, area, origin, direction, grid, 'euclidean', map.walls);
  return inside.filter((token) => {
    // Изгнанные (Banishment) вне поля: цели и аур их не видят.
    if (isBanished(token)) return false;
    if (opts.excludeId && token.id === opts.excludeId) return false;
    if (opts.side && opts.source && !sideMatches(opts.source, token, opts.side)) return false;
    if (opts.excludeSource && opts.source && token.id === opts.source.id) return false;
    return true;
  });
}
