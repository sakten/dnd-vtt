import type { ZoneInstance } from './automation';
import type { CombatState } from './combat';
import type { Token } from './token';

export interface GridSettings {
  size: number;
  color: string;
  opacity: number;
  visible: boolean;
  offsetX: number;
  offsetY: number;
  snap: boolean;
}

export interface FogState {
  size: number;
  offsetX: number;
  offsetY: number;
  hidden: string[];
}

/** Настройки видимости карты (DM): обзор от токенов игроков + режим «Темнота». */
export interface VisionSettings {
  los: boolean;
  darkness: boolean;
}

export const DEFAULT_VISION: VisionSettings = { los: false, darkness: false };

export type WallKind = 'wall' | 'door' | 'window';

export type LightAreaKind = 'darkness' | 'magical' | 'obscured' | 'opaque';

/** Область тьмы/мглы: прямоугольник по узлам сетки; вид задаёт правила восприятия. */
export interface LightArea {
  id: string;
  kind: LightAreaKind;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Сегмент стены по узлам сетки: обзор (kind) и проход/действия — независимые оси. */
export interface Wall {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind: WallKind;
  /** Дверь: закрыта (по умолчанию) или открыта. Для остальных видов не используется. */
  open?: boolean;
  /** Дверь: открывать/закрывать может только DM (игрок видит закрытый замочек). */
  dmOnly?: boolean;
  /** Дверь: Сл проверки Ловкости рук (0/нет — замок не заперт). */
  pickDc?: number;
  /** Каст/атаки/телепорт сквозь (нет — решает kind: `wall` блокирует, `window` — нет). */
  blocksActions?: boolean;
  /** Проход (по умолчанию режет; false — сегмент зоны, не режущий движение). */
  blocksMovement?: boolean;
}

/** Эфемерный штрих рисования на карте: рассылается всем и гаснет у клиентов через 10 с. */
export interface DrawStroke {
  id: string;
  mapId: string;
  color: string;
  /** Точки в мировых координатах. */
  points: { x: number; y: number }[];
}

export const DEFAULT_GRID: GridSettings = {
  size: 50,
  color: '#ffffff',
  opacity: 0.35,
  visible: true,
  offsetX: 0,
  offsetY: 0,
  snap: true,
};

/** Лимиты патчей карты: больше сервер не принимает (усекает). */
export const MAX_FOG_CELLS = 50_000;
export const MAX_WALL_SEGMENTS = 2000;
export const MAX_LIGHT_AREAS = 200;

export function defaultFog(grid: GridSettings): FogState {
  return { size: grid.size, offsetX: grid.offsetX, offsetY: grid.offsetY, hidden: [] };
}

/**
 * Сетка карты с фолбэками: карта → дефолт комнаты → `DEFAULT_GRID`
 * (size 50, offset 0, snap). Единый резолвер для сервера и клиента.
 */
export function gridOfMap(
  map?: { grid?: Partial<GridSettings> } | null,
  sceneGrid?: Partial<GridSettings> | null
): GridSettings {
  const src = map?.grid ?? sceneGrid;
  return {
    size: src?.size || DEFAULT_GRID.size,
    color: src?.color ?? DEFAULT_GRID.color,
    opacity: src?.opacity ?? DEFAULT_GRID.opacity,
    visible: src?.visible ?? DEFAULT_GRID.visible,
    offsetX: src?.offsetX ?? DEFAULT_GRID.offsetX,
    offsetY: src?.offsetY ?? DEFAULT_GRID.offsetY,
    snap: src?.snap ?? DEFAULT_GRID.snap,
  };
}

export interface MapInfo {
  id: string;
  name: string;
  url: string;
  width: number;
  height: number;
  tokens: Token[];
  /** Активные зоны/области (Web, Spirit Guardians…). */
  zones: ZoneInstance[];
  /** Стены/двери/окна (LOS и проход; двери/окна — в следующих срезах). */
  walls: Wall[];
  /** Видимость: обзор игроков от токенов игрока (стены блокируют). */
  vision: VisionSettings;
  /** Области тьмы/магической тьмы/мглы. */
  lightAreas: LightArea[];
  fog: FogState;
  /** Сетка карты: у каждой карты своя (размер/сдвиг/цвет/снэп). */
  grid: GridSettings;
  combat: CombatState;
}

export function snapToGrid(v: number, offset: number, size: number, cells: number): number {
  if (cells % 2 === 1) {
    return Math.round((v - offset - size / 2) / size) * size + offset + size / 2;
  }
  return Math.round((v - offset) / size) * size + offset;
}

export interface Scene {
  maps: MapInfo[];
  activeMapId: string | null;
  /** Дефолтная сетка комнаты: с неё начинают новые карты и пустая комната. */
  grid: GridSettings;
}
