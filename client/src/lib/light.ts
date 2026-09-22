import { useMemo } from 'react';
import {
  lightCells,
  type GridSettings,
  type LightLevel,
  type LightSource,
  type Token,
  type ZoneInstance,
} from 'shared';
import { useGameStore } from '../store/useGameStore';
import { useActiveMap } from '../store/hooks';
import { activeGridOf } from '../store/selectors';

export interface MapLightSource {
  key: string;
  x: number;
  y: number;
  light: LightSource;
}

/** Свет ярче: bright > dim, при равенстве — больший суммарный радиус. */
function brighter(a: LightSource, b: LightSource): boolean {
  const rank = (l: LightSource) => (l.bright > 0 ? 2 : 1);
  if (rank(a) !== rank(b)) return rank(a) > rank(b);
  return a.bright + a.dim > b.bright + b.dim;
}

/** Источники света карты: максимум на токен (эффекты) + светящиеся зоны. */
export function mapLights(tokens: Token[], zones: ZoneInstance[]): MapLightSource[] {
  const items: MapLightSource[] = [];
  for (const token of tokens) {
    let best: LightSource | undefined;
    for (const effect of token.effects) {
      if (!effect.light || effect.hidden) continue;
      if (!best || brighter(effect.light, best)) best = effect.light;
    }
    if (best) items.push({ key: `t:${token.id}`, x: token.x, y: token.y, light: best });
  }
  for (const zone of zones) {
    if (!zone.light || !zone.origin) continue;
    items.push({ key: `z:${zone.id}`, x: zone.origin.x, y: zone.origin.y, light: zone.light });
  }
  return items;
}

/** Клетки света карты с тенями от стен (пересчёт по токенам/зонам/стенам/сетке). */
export function useMapLight(): Map<string, LightLevel> {
  const map = useActiveMap();
  const grid: GridSettings = useGameStore(activeGridOf);
  const tokens = map?.tokens;
  const zones = map?.zones;
  const walls = map?.walls;
  return useMemo(() => {
    if (!tokens) return new Map<string, LightLevel>();
    const emitters = mapLights(tokens, zones ?? []).map((l) => ({ x: l.x, y: l.y, light: l.light }));
    return lightCells(emitters, { size: grid.size || 50, offsetX: grid.offsetX, offsetY: grid.offsetY }, walls ?? []);
  }, [tokens, zones, walls, grid.size, grid.offsetX, grid.offsetY]);
}
