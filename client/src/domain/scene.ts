import {
  snapToGrid,
  type CombatState,
  type FogState,
  type GridSettings,
  type MapInfo,
  type Scene,
  type Token,
} from 'shared';

export function updateMap(scene: Scene, mapId: string, updater: (map: MapInfo) => MapInfo): Scene {
  const idx = scene.maps.findIndex((m) => m.id === mapId);
  if (idx < 0) return scene;
  const maps = [...scene.maps];
  maps[idx] = updater(maps[idx]);
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

export function setFog(scene: Scene, mapId: string, fog: FogState): Scene {
  return updateMap(scene, mapId, (m) => ({ ...m, fog }));
}

export function setGrid(scene: Scene, grid: GridSettings): Scene {
  return { ...scene, grid };
}

export function resizeGrid(scene: Scene, grid: GridSettings): Scene {
  const size = grid.size;
  return {
    ...scene,
    grid,
    maps: scene.maps.map((m) => ({
      ...m,
      tokens: m.tokens.map((t) => {
        const resized = { ...t, w: t.cells * size, h: t.cells * size };
        if (grid.snap) {
          resized.x = snapToGrid(t.x, grid.offsetX, size, t.cells);
          resized.y = snapToGrid(t.y, grid.offsetY, size, t.cells);
        }
        return resized;
      }),
    })),
  };
}
