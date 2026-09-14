import { DEFAULT_GRID, defaultFog } from '../domain/scene';
import type { FogState, GridSettings, MapInfo, Scene } from '../domain/scene';
import { normalizeCombatState } from './combat';
import { isRecord } from './guards';
import { normalizeToken } from './token';
import type { NormalizeEntityOptions } from './token';

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
