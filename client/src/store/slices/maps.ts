import { MAX_FOG_CELLS, MAX_LIGHT_AREAS, MAX_WALL_SEGMENTS } from 'shared';
import { applyMapGrid, setFog, setLightAreas, setVision, setWalls, setZones, withMaps } from '../../domain/scene';
import { activeMapOf } from '../selectors';
import { emit, emitInMap, emitThrottled } from '../helpers';
import { UI_RESET } from '../uiReset';
import type { GameState, Slice } from '../types';

export const createMapSlice: Slice<Pick<GameState, 'onMapsUpdate' | 'onMapBring' | 'onFogUpdate' | 'onWallsUpdate' | 'onVisionUpdate' | 'onAreasUpdate' | 'onZonesUpdate' | 'onGridUpdate' | 'addMap' | 'removeMap' | 'renameMap' | 'switchMap' | 'bringMap' | 'updateGrid' | 'toggleDoor' | 'updateFog' | 'updateWalls' | 'updateVision' | 'updateAreas'>> = (set, get) => {
  // Клиент режет payload теми же лимитами, что и сервер: локальная и серверная версии не расходятся.
  const limitError = (what: string, max: number) =>
    get().onChatError(`Достигнут лимит ${what} (${max}) — лишнее не сохранится`);
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
    onVisionUpdate: ({ mapId, vision }) => set((s) => ({ scene: setVision(s.scene, mapId, vision) })),
    onAreasUpdate: ({ mapId, lightAreas }) => set((s) => ({ scene: setLightAreas(s.scene, mapId, lightAreas) })),
    onZonesUpdate: ({ mapId, zones }) => set((s) => ({ scene: setZones(s.scene, mapId, zones) })),
    onGridUpdate: ({ mapId, grid }) =>
      set((s) => ({ scene: applyMapGrid({ ...s.scene, grid }, mapId, grid) })),

    addMap: (name, url, width, height, grid) => {
      emit(get, 'map:add', { name, url, width, height, ...(grid ? { grid } : {}) });
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

    updateGrid: (patch, mapId) => {
      if (!get().socket) return;
      const target = mapId ?? activeMapOf(get())?.id ?? null;
      if (!target) {
        // Карты нет — правим только дефолт комнаты (новые карты начнут с него).
        set((s) => ({ scene: { ...s.scene, grid: { ...s.scene.grid, ...patch } } }));
        return;
      }
      set((s) => {
        const map = s.scene.maps.find((m) => m.id === target);
        if (!map) return {};
        const grid = { ...map.grid, ...patch };
        // Дефолт комнаты — последняя настроенная сетка.
        return { scene: applyMapGrid({ ...s.scene, grid }, target, grid) };
      });
      emitThrottled(get, `grid:${target}`, 150, 'grid:update', () => {
        const map = get().scene.maps.find((m) => m.id === target);
        return map ? { mapId: target, grid: map.grid } : undefined;
      });
    },

    toggleDoor: (wallId) => {
      emitInMap(get, 'door:toggle', { wallId });
    },

    updateFog: (mapId, fog) => {
      if (!get().socket) return;
      const hidden = fog.hidden.slice(0, MAX_FOG_CELLS);
      if (hidden.length !== fog.hidden.length) limitError('клеток тумана', MAX_FOG_CELLS);
      const next = hidden.length === fog.hidden.length ? fog : { ...fog, hidden };
      set((s) => ({ scene: setFog(s.scene, mapId, next) }));
      emitThrottled(get, `fog:${mapId}`, 120, 'fog:update', () => {
        const latest = get().scene.maps.find((m) => m.id === mapId)?.fog;
        return latest ? { mapId, fog: latest } : undefined;
      });
    },

    updateWalls: (mapId, walls) => {
      if (!get().socket) return;
      const next = walls.slice(0, MAX_WALL_SEGMENTS);
      if (next.length !== walls.length) limitError('стен', MAX_WALL_SEGMENTS);
      set((s) => ({ scene: setWalls(s.scene, mapId, next) }));
      emitThrottled(get, `walls:${mapId}`, 150, 'walls:update', () => {
        const latest = get().scene.maps.find((m) => m.id === mapId)?.walls;
        return latest ? { mapId, walls: latest } : undefined;
      });
    },

    updateVision: (mapId, vision) => {
      if (!get().socket) return;
      set((s) => ({ scene: setVision(s.scene, mapId, vision) }));
      emit(get, 'vision:update', { mapId, vision });
    },

    updateAreas: (mapId, areas) => {
      if (!get().socket) return;
      const next = areas.slice(0, MAX_LIGHT_AREAS);
      if (next.length !== areas.length) limitError('областей', MAX_LIGHT_AREAS);
      set((s) => ({ scene: setLightAreas(s.scene, mapId, next) }));
      emitThrottled(get, `areas:${mapId}`, 150, 'areas:update', () => {
        const latest = get().scene.maps.find((m) => m.id === mapId)?.lightAreas;
        return latest ? { mapId, lightAreas: latest } : undefined;
      });
    },
  };
};
