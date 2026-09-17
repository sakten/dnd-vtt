import {
  snapToGrid,
  type CombatState,
  type FogState,
  type GridSettings,
  type LightArea,
  type MapInfo,
  type Scene,
  type Token,
  type VisionSettings,
  type Wall,
} from 'shared';

export function updateMap(scene: Scene, mapId: string, updater: (map: MapInfo) => MapInfo): Scene {
  const idx = scene.maps.findIndex((m) => m.id === mapId);
  if (idx < 0) return scene;
  const maps = [...scene.maps];
  maps[idx] = updater(maps[idx]!);
  return { ...scene, maps };
}

export function withMaps(scene: Scene, maps: Scene['maps'], activeMapId: string | null): Scene {
  return { ...scene, maps, activeMapId };
}

export function upsertToken(scene: Scene, mapId: string, token: Token): Scene {
  return updateMap(scene, mapId, (m) =>
    m.tokens.some((t) => t.id === token.id) ? m : { ...m, tokens: [...m.tokens, token] }
  );
}

export function replaceToken(scene: Scene, mapId: string, token: Token): Scene {
  return updateMap(scene, mapId, (m) => ({
    ...m,
    tokens: m.tokens.map((t) => (t.id === token.id ? token : t)),
  }));
}

export function patchToken(scene: Scene, mapId: string, id: string, patch: Partial<Token>): Scene {
  return updateMap(scene, mapId, (m) => ({
    ...m,
    tokens: m.tokens.map((t) => (t.id === id ? { ...t, ...patch } : t)),
  }));
}

export function removeTokenById(scene: Scene, mapId: string, id: string): Scene {
  return updateMap(scene, mapId, (m) => ({ ...m, tokens: m.tokens.filter((t) => t.id !== id) }));
}

export function setCombat(scene: Scene, mapId: string, combat: CombatState): Scene {
  return updateMap(scene, mapId, (m) => ({ ...m, combat }));
}

export function patchCombatTurn(
  scene: Scene,
  mapId: string,
  entryId: string,
  patch: Partial<CombatState['turns'][string]>
): Scene {
  return updateMap(scene, mapId, (m) => {
    const turn = m.combat.turns[entryId];
    if (!turn) return m;
    return { ...m, combat: { ...m.combat, turns: { ...m.combat.turns, [entryId]: { ...turn, ...patch } } } };
  });
}

export function setFog(scene: Scene, mapId: string, fog: FogState): Scene {
  return updateMap(scene, mapId, (m) => ({ ...m, fog }));
}

export function setWalls(scene: Scene, mapId: string, walls: Wall[]): Scene {
  return updateMap(scene, mapId, (m) => ({ ...m, walls }));
}

export function setVision(scene: Scene, mapId: string, vision: VisionSettings): Scene {
  return updateMap(scene, mapId, (m) => ({ ...m, vision }));
}

export function setLightAreas(scene: Scene, mapId: string, lightAreas: LightArea[]): Scene {
  return updateMap(scene, mapId, (m) => ({ ...m, lightAreas }));
}

export function setZones(scene: Scene, mapId: string, zones: MapInfo['zones']): Scene {
  return updateMap(scene, mapId, (m) => ({ ...m, zones }));
}

/**
 * Сетка одной карты: применяем настройки, пересчитываем размеры/позиции её токенов
 * и клетки её тумана. Другие карты не трогаем (независимые сетки).
 */
export function applyMapGrid(scene: Scene, mapId: string, grid: GridSettings): Scene {
  return updateMap(scene, mapId, (m) => ({
    ...m,
    grid,
    fog: { ...m.fog, size: grid.size, offsetX: grid.offsetX, offsetY: grid.offsetY },
    tokens: m.tokens.map((t) => {
      const resized = { ...t, w: t.cells * grid.size, h: t.cells * grid.size };
      if (grid.snap) {
        resized.x = snapToGrid(t.x, grid.offsetX, grid.size, t.cells);
        resized.y = snapToGrid(t.y, grid.offsetY, grid.size, t.cells);
      }
      return resized;
    }),
  }));
}
