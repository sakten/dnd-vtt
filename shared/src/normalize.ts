import {
  DEFAULT_GRID,
  DEFAULT_SPEED,
  defaultFog,
  normalizeCombatState,
  normalizeConditions,
  normalizeEffects,
  normalizeStatblock,
  statNumber,
  type FogState,
  type GridSettings,
  type LibraryItem,
  type MapInfo,
  type Scene,
  type Token,
  type TokenFields,
} from './types';
import { normalizeTokenFields } from './fields';

/** Объект-запись (не null/массив) — общая проверка payload и данных с диска. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export interface NormalizeEntityOptions {
  /** Лимит имени: 40 — токен, 60 — предмет библиотеки. */
  nameLimit?: number;
  /** Не требовать пару AC+hpMax (данные с диска старых версий). */
  keepAcHp?: boolean;
}

/**
 * Полная нормализация токена: поля реестра `TokenFields` + боевые поля вне него.
 * Неизвестные поля сохраняются (прямая и обратная совместимость формата).
 */
export function normalizeToken(raw: unknown, opts: NormalizeEntityOptions = {}): Token {
  const source = isRecord(raw) ? raw : {};
  const fields = normalizeTokenFields(source as Partial<TokenFields>, opts.nameLimit ?? 40, {
    keepAcHp: opts.keepAcHp === true,
  });
  const statblock = normalizeStatblock(source.statblock);
  const token: Token = {
    ...(source as unknown as Token),
    ...fields,
    libraryItemId: typeof source.libraryItemId === 'string' ? source.libraryItemId : '',
    hpCurrent:
      typeof source.hpCurrent === 'number' && Number.isFinite(source.hpCurrent)
        ? source.hpCurrent
        : statNumber(fields.hpMax),
    hpTemp:
      typeof source.hpTemp === 'number' && Number.isFinite(source.hpTemp)
        ? Math.max(0, Math.round(source.hpTemp))
        : 0,
    faction:
      source.faction === 'ally' || source.faction === 'enemy' || source.faction === 'neutral'
        ? source.faction
        : 'neutral',
    speed:
      typeof source.speed === 'number' && Number.isFinite(source.speed)
        ? Math.max(0, Math.round(source.speed))
        : DEFAULT_SPEED,
    conditions: normalizeConditions(source.conditions),
    effects: normalizeEffects(source.effects),
  };
  if (statblock) token.statblock = statblock;
  else delete token.statblock;
  return token;
}

/** Полная нормализация предмета библиотеки (legacy `url` → `imageUrl`). */
export function normalizeLibraryItem(raw: unknown): LibraryItem {
  const { url, ...rest } = isRecord(raw) ? raw : {};
  const source = rest as Record<string, unknown>;
  const imageUrl =
    typeof source.imageUrl === 'string' ? source.imageUrl : typeof url === 'string' ? url : '';
  const fields = normalizeTokenFields({ ...source, imageUrl } as Partial<TokenFields>, 60, {
    keepAcHp: true,
  });
  return {
    ...(source as unknown as LibraryItem),
    ...fields,
    id: typeof source.id === 'string' ? source.id : '',
  };
}

/** Полная нормализация карты: токены, туман и бой; остальные поля сохраняются. */
export function normalizeMapInfo(
  raw: unknown,
  grid: GridSettings,
  opts: NormalizeEntityOptions = {}
): MapInfo {
  const source = isRecord(raw) ? raw : {};
  const fogSource = isRecord(source.fog) ? source.fog : null;
  const fog: FogState = fogSource
    ? {
        ...(fogSource as unknown as FogState),
        hidden: Array.isArray(fogSource.hidden) ? (fogSource.hidden as string[]) : [],
      }
    : defaultFog(grid);
  return {
    ...(source as unknown as MapInfo),
    tokens: Array.isArray(source.tokens) ? source.tokens.map((t) => normalizeToken(t, opts)) : [],
    fog,
    combat: normalizeCombatState(source.combat),
  };
}

/** Полная нормализация сцены: все карты через `normalizeMapInfo`, грид и активная карта. */
export function normalizeScene(raw: unknown, opts: NormalizeEntityOptions = {}): Scene {
  const source = isRecord(raw) ? raw : {};
  const grid = isRecord(source.grid) ? (source.grid as unknown as GridSettings) : DEFAULT_GRID;
  return {
    ...(source as unknown as Scene),
    maps: Array.isArray(source.maps)
      ? source.maps.map((m) => normalizeMapInfo(m, grid, opts))
      : [],
    activeMapId: typeof source.activeMapId === 'string' ? source.activeMapId : null,
    grid,
  };
}
