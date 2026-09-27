import { useEffect, useMemo, useState } from 'react';
import {
  isBanished,
  mapLightCells,
  mapLights,
  wallsWithZones,
  type GridSettings,
  type LightLevel,
} from 'shared';
import { useGameStore } from '../store/useGameStore';
import { useActiveMap } from '../store/hooks';
import { activeGridOf } from '../store/selectors';

// Источники света и расчёт клеток — общие с сервером (shared), ключи нужны LightLayer.
export { mapLights, type MapLightSource } from 'shared';

const EMPTY: Map<string, LightLevel> = new Map();
/** Порог пересчёта при частых изменениях (драг): тени в полёте — косметика. */
const THROTTLE_MS = 120;

interface LightCache {
  mapId: string;
  /** Все входы расчёта: стены и зоны (identity), эмиттеры/сетка/размер — в `key`. */
  walls: unknown;
  zones: unknown;
  key: string;
  value: Map<string, LightLevel>;
  at: number;
}
/** Один расчёт на карту для всех компонентов (TableTop/TokenView/ConditionsOverlay). */
let cache: LightCache | null = null;
const listeners = new Set<() => void>();
let trailing: ReturnType<typeof setTimeout> | null = null;

/** Сигнатура светящих эмиттеров: позиции/свет токенов и свет зон (выбор ярчайшего — как в `mapLights`). */
function lightKey(
  present: Parameters<typeof mapLights>[0],
  zones: Parameters<typeof mapLights>[1],
  grid: GridSettings,
  size: { width: number; height: number }
): string {
  const emitters = mapLights(present, zones, grid.size || 50).map(
    (l) => `${l.key}@${l.x},${l.y}:${l.light.bright}/${l.light.dim}/${l.light.sunlight ? 1 : 0}`
  );
  return `${emitters.join('|')}#${grid.size}/${grid.offsetX}/${grid.offsetY}/${size.width}x${size.height}`;
}

/** Клетки света карты с тенями от стен (пересчёт по токенам/зонам/стенам/сетке). */
export function useMapLight(): Map<string, LightLevel> {
  const map = useActiveMap();
  const grid: GridSettings = useGameStore(activeGridOf);
  const tokens = map?.tokens;
  const zones = map?.zones;
  const walls = map?.walls;
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return useMemo(() => {
    if (!map || !tokens) return EMPTY;
    // Изгнанные (Banishment) вне поля: свет их эффектов не считаем.
    const present = tokens.filter((t) => !isBanished(t));
    const areaGrid = { size: grid.size || 50, offsetX: grid.offsetX, offsetY: grid.offsetY };
    const size = { width: map.width, height: map.height };
    const key = lightKey(present, zones ?? [], grid, size);
    const now = Date.now();
    if (cache && cache.mapId === map.id && cache.walls === walls && cache.zones === zones && cache.key === key) {
      return cache.value;
    }
    // Частые изменения (драг токена): отдаём прошлый свет и планируем досчёт после паузы.
    if (cache && cache.mapId === map.id && now - cache.at < THROTTLE_MS) {
      if (trailing === null) {
        trailing = setTimeout(() => {
          trailing = null;
          if (cache) cache = { ...cache, at: 0 };
          for (const listener of listeners) listener();
        }, THROTTLE_MS);
      }
      return cache.value;
    }
    // Границы — карта целиком: без них свет 120+ фт прогоняет поле 97×97 с тенями вне карты.
    const bounds = {
      cx0: 0,
      cy0: 0,
      cx1: Math.max(0, Math.ceil(map.width / areaGrid.size) - 1),
      cy1: Math.max(0, Math.ceil(map.height / areaGrid.size) - 1),
    };
    const value = mapLightCells(
      present,
      zones ?? [],
      areaGrid,
      wallsWithZones(walls ?? [], zones ?? [], areaGrid),
      bounds
    );
    cache = { mapId: map.id, walls, zones, key, value, at: now };
    return value;
  }, [map, tokens, zones, walls, grid.size, grid.offsetX, grid.offsetY, tick]);
}
