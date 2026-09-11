import { resizeGrid, setFog, setGrid, withMaps } from '../../domain/scene';
import { throttled } from '../helpers';
import type { GameState, Slice } from '../types';

export const createMapSlice: Slice<Pick<GameState, 'onMapsUpdate' | 'onMapBring' | 'onFogUpdate' | 'onGridUpdate' | 'addMap' | 'removeMap' | 'renameMap' | 'switchMap' | 'bringMap' | 'updateGrid' | 'updateFog'>> = (set, get) => {
  const clearTokenUi = () =>
    set({ selectedTokenId: null, tokenMenuId: null, draggingTokenId: null, targetTokenId: null, measureFromId: null });

  return {
    onMapsUpdate: ({ maps, activeMapId }) => {
      set((s) => {
        const current = s.viewMapId;
        const valid = current !== null && maps.some((m) => m.id === current);
        const nextView = valid ? current : activeMapId ?? maps[0]?.id ?? null;
        return {
          scene: withMaps(s.scene, maps, activeMapId),
          viewMapId: nextView,
          selectedTokenId: null,
          tokenMenuId: null,
          draggingTokenId: null,
          targetTokenId: null,
        };
      });
      window.setTimeout(() => get().fitView(), 30);
    },

    onMapBring: ({ activeMapId }) => {
      set({
        viewMapId: activeMapId,
        selectedTokenId: null,
        tokenMenuId: null,
        draggingTokenId: null,
        targetTokenId: null,
      });
      window.setTimeout(() => get().fitView(), 30);
    },

    onFogUpdate: ({ mapId, fog }) => set((s) => ({ scene: setFog(s.scene, mapId, fog) })),
    onGridUpdate: (grid) => set((s) => ({ scene: setGrid(s.scene, grid) })),

    addMap: (name, url, width, height) => {
      get().socket?.emit('map:add', { name, url, width, height });
    },

    removeMap: (id) => {
      get().socket?.emit('map:remove', id);
    },

    renameMap: (id, name) => {
      get().socket?.emit('map:rename', { id, name });
    },

    switchMap: (id) => {
      set({ viewMapId: id, targetTokenId: null });
      clearTokenUi();
      get().fitView();
    },

    bringMap: (id) => {
      get().socket?.emit('map:bring', id);
    },

    updateGrid: (patch) => {
      const socket = get().socket;
      if (!socket) return;
      set((s) => {
        const grid = { ...s.scene.grid, ...patch };
        return { scene: resizeGrid(s.scene, grid) };
      });
      throttled('grid', 150, () => socket.emit('grid:update', get().scene.grid));
    },

    updateFog: (mapId, fog) => {
      const socket = get().socket;
      if (!socket) return;
      set((s) => ({ scene: setFog(s.scene, mapId, fog) }));
      throttled(`fog:${mapId}`, 120, () => {
        const latest = get().scene.maps.find((m) => m.id === mapId)?.fog;
        if (latest) socket.emit('fog:update', { mapId, fog: latest });
      });
    },
  };
};
