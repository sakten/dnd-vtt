import { useMemo } from 'react';
import { isBanished, mapLightCells, type GridSettings, type LightLevel } from 'shared';
import { useGameStore } from '../store/useGameStore';
import { useActiveMap } from '../store/hooks';
import { activeGridOf } from '../store/selectors';

// Источники света и расчёт клеток — общие с сервером (shared), ключи нужны LightLayer.
export { mapLights, type MapLightSource } from 'shared';

/** Клетки света карты с тенями от стен (пересчёт по токенам/зонам/стенам/сетке). */
export function useMapLight(): Map<string, LightLevel> {
  const map = useActiveMap();
  const grid: GridSettings = useGameStore(activeGridOf);
  const tokens = map?.tokens;
  const zones = map?.zones;
  const walls = map?.walls;
  return useMemo(() => {
    if (!tokens) return new Map<string, LightLevel>();
    // Изгнанные (Banishment) вне поля: свет их эффектов не считаем.
    const present = tokens.filter((t) => !isBanished(t));
    return mapLightCells(present, zones ?? [], { size: grid.size || 50, offsetX: grid.offsetX, offsetY: grid.offsetY }, walls ?? []);
  }, [tokens, zones, walls, grid.size, grid.offsetX, grid.offsetY]);
}
