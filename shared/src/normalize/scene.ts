import type { ZoneInstance } from '../domain/automation';
import { DEFAULT_GRID, DEFAULT_VISION, defaultFog } from '../domain/scene';
import type { FogState, GridSettings, LightArea, LightAreaKind, MapInfo, Scene, VisionSettings, Wall, WallKind } from '../domain/scene';
import { normalizeCombatState } from './combat';
import { isRecord } from './guards';
import { normalizeToken } from './token';
import type { NormalizeEntityOptions } from './token';

/** Нормализация зоны: обязательны id/источник/область/точка/длительность. */
function normalizeZone(raw: unknown): ZoneInstance | null {
  if (!isRecord(raw)) return null;
  const origin = isRecord(raw.origin) ? raw.origin : null;
  if (
    typeof raw.id !== 'string' ||
    !raw.id ||
    typeof raw.sourceKey !== 'string' ||
    typeof raw.sourceId !== 'string' ||
    !isRecord(raw.area) ||
    !origin ||
    !Number.isFinite(origin.x) ||
    !Number.isFinite(origin.y) ||
    !isRecord(raw.duration)
  ) {
    return null;
  }
  return {
    ...(raw as unknown as ZoneInstance),
    origin: { x: Number(origin.x), y: Number(origin.y) },
    occupants: Array.isArray(raw.occupants)
      ? (raw.occupants as unknown[]).filter((x): x is string => typeof x === 'string')
      : [],
  };
}

const WALL_KINDS: WallKind[] = ['wall', 'door', 'window'];

/** Нормализация видимости: флаги приводим к boolean, дефолт — выключено. */
export function normalizeVision(raw: unknown): VisionSettings {
  if (!isRecord(raw)) return { ...DEFAULT_VISION };
  return { los: raw.los === true, darkness: raw.darkness === true };
}

const LIGHT_AREA_KINDS: LightAreaKind[] = ['darkness', 'magical', 'obscured'];

/** Нормализация областей тьмы/мглы: известные виды, положительные размеры, лимит 200. */
export function normalizeLightAreas(raw: unknown): LightArea[] {
  if (!Array.isArray(raw)) return [];
  const out: LightArea[] = [];
  for (const item of raw.slice(0, 200)) {
    if (!isRecord(item)) continue;
    const kind = LIGHT_AREA_KINDS.includes(item.kind as LightAreaKind) ? (item.kind as LightAreaKind) : null;
    if (!kind) continue;
    const x = Number(item.x);
    const y = Number(item.y);
    const w = Number(item.w);
    const h = Number(item.h);
    if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) continue;
    out.push({ id: String(item.id ?? ''), kind, x, y, w, h });
  }
  return out;
}

/** Нормализация стены: числовые координаты, известный вид, лимит сегментов. */
export function normalizeWalls(raw: unknown): Wall[] {
  if (!Array.isArray(raw)) return [];
  const out: Wall[] = [];
  for (const item of raw.slice(0, 2000)) {
    if (!isRecord(item)) continue;
    const { x1, y1, x2, y2 } = item;
    if (![x1, y1, x2, y2].every((v) => Number.isFinite(v))) continue;
    const kind = WALL_KINDS.includes(item.kind as WallKind) ? (item.kind as WallKind) : 'wall';
    out.push({
      id: String(item.id ?? ''),
      kind,
      x1: Number(x1),
      y1: Number(y1),
      x2: Number(x2),
      y2: Number(y2),
      ...(kind === 'door' && item.open === true ? { open: true } : {}),
    });
  }
  return out;
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
    zones: Array.isArray(source.zones)
      ? source.zones.map(normalizeZone).filter((z): z is ZoneInstance => !!z)
      : [],
    walls: normalizeWalls(source.walls),
    vision: normalizeVision(source.vision),
    lightAreas: normalizeLightAreas(source.lightAreas),
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
