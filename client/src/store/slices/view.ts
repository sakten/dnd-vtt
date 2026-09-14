import { activeMapOf } from '../selectors';
import type { GameState, Slice } from '../types';

export const createViewSlice: Slice<Pick<GameState, 'setView' | 'setViewport' | 'setGridModalOpen' | 'setRoomSettingsOpen' | 'setFogMode' | 'fitView'>> = (set, get) => {
  return {
    setView: (view) => set({ view }),
    setViewport: (viewport) => set({ viewport }),

    setGridModalOpen: (gridModalOpen) => set({ gridModalOpen }),

    setRoomSettingsOpen: (roomSettingsOpen) => set({ roomSettingsOpen }),

    setFogMode: (patch) => set((s) => ({ fogMode: { ...s.fogMode, ...patch } })),

    fitView: () => {
      const { viewport } = get();
      const map = activeMapOf(get());
      if (!map || viewport.w === 0 || viewport.h === 0) return;
      const scale = Math.min(
        8,
        Math.max(0.05, Math.min(viewport.w / map.width, viewport.h / map.height) * 0.95)
      );
      const x = (viewport.w - map.width * scale) / 2;
      const y = (viewport.h - map.height * scale) / 2;
      set({ view: { x, y, scale } });
    },
  };
};
