import { resizeGrid, setFog, setGrid, setWalls, withMaps } from '../../domain/scene';
import { emit, emitThrottled } from '../helpers';
import { UI_RESET } from '../uiReset';
import type { GameState, Slice } from '../types';

export const createMapSlice: Slice<Pick<GameState, 'onMapsUpdate' | 'onMapBring' | 'onFogUpdate' | 'onWallsUpdate' | 'onGridUpdate' | 'addMap' | 'removeMap' | 'renameMap' | 'switchMap' | 'bringMap' | 'updateGrid' | 'updateFog' | 'updateWalls'>> = (set, get) => {
  return {
    onMapsUpdate: ({ maps, activeMapId }) => {
      set((s) => {
        const current = s.viewMapId;
        const valid = current !== null && maps.some((m) => m.id === current);
        const nextView = valid ? current : activeMapId ?? maps[0]?.id ?? null;
        return {
          ...UI_RESET,
          scene: withMaps(s.scene, maps, activeMapId),
          viewMapId: nextView,
        };
      });
      window.setTimeout(() => get().fitView(), 30);
    },

    onMapBring: ({ activeMapId }) => {
      set({ ...UI_RESET, viewMapId: activeMapId });
      window.setTimeout(() => get().fitView(), 30);
    },

    onFogUpdate: ({ mapId, fog }) => set((s) => ({ scene: setFog(s.scene, mapId, fog) })),
    onWallsUpdate: ({ mapId, walls }) => set((s) => ({ scene: setWalls(s.scene, mapId, walls) })),
    onGridUpdate: (grid) => set((s) => ({ scene: setGrid(s.scene, grid) })),

    addMap: (name, url, width, height) => {
      emit(get, 'map:add', { name, url, width, height });
    },

    removeMap: (id) => {
      emit(get, 'map:remove', id);
    },

    renameMap: (id, name) => {
      emit(get, 'map:rename', { id, name });
    },

    switchMap: (id) => {
      set({ ...UI_RESET, viewMapId: id });
      get().fitView();
    },

    bringMap: (id) => {
      emit(get, 'map:bring', id);
    },

    updateGrid: (patch) => {
      if (!get().socket) return;
      set((s) => {
        const grid = { ...s.scene.grid, ...patch };
        return { scene: resizeGrid(s.scene, grid) };
      });
      emitThrottled(get, 'grid', 150, 'grid:update', () => get().scene.grid);
    },

    updateFog: (mapId, fog) => {
      if (!get().socket) return;
      set((s) => ({ scene: setFog(s.scene, mapId, fog) }));
      emitThrottled(get, `fog:${mapId}`, 120, 'fog:update', () => {
        const latest = get().scene.maps.find((m) => m.id === mapId)?.fog;
        return latest ? { mapId, fog: latest } : undefined;
      });
    },

    updateWalls: (mapId, walls) => {
      if (!get().socket) return;
      set((s) => ({ scene: setWalls(s.scene, mapId, walls) }));
      emitThrottled(get, `walls:${mapId}`, 150, 'walls:update', () => {
        const latest = get().scene.maps.find((m) => m.id === mapId)?.walls;
        return latest ? { mapId, walls: latest } : undefined;
      });
    },
  };
};
