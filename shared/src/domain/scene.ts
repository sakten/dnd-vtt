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

export type WallKind = 'wall' | 'door' | 'window';

/** Сегмент стены по узлам сетки: блокирует обзор (и позже — движение). */
export interface Wall {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind: WallKind;
  /** Дверь: закрыта (по умолчанию) или открыта. Для остальных видов не используется. */
  open?: boolean;
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

export function defaultFog(grid: GridSettings): FogState {
  return { size: grid.size, offsetX: grid.offsetX, offsetY: grid.offsetY, hidden: [] };
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
  fog: FogState;
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
  grid: GridSettings;
}
