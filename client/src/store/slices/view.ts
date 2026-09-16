import { activeMapOf } from '../selectors';
import type { GameState, Slice } from '../types';

export const createViewSlice: Slice<Pick<GameState, 'setView' | 'setViewport' | 'setGridModalOpen' | 'setVisionModalOpen' | 'setRoomSettingsOpen' | 'setFogMode' | 'setWallsMode' | 'setLightMode' | 'setWallCandidates' | 'fitView'>> = (set, get) => {
  return {
    setView: (view) => set({ view }),
    setViewport: (viewport) => set({ viewport }),

    setGridModalOpen: (gridModalOpen) => set({ gridModalOpen }),

    setVisionModalOpen: (visionModalOpen) => set({ visionModalOpen }),

    setRoomSettingsOpen: (roomSettingsOpen) => set({ roomSettingsOpen }),

    setFogMode: (patch) => set((s) => ({ fogMode: { ...s.fogMode, ...patch } })),

    setWallsMode: (patch) => set((s) => ({ wallsMode: { ...s.wallsMode, ...patch } })),

    setLightMode: (patch) => set((s) => ({ lightMode: { ...s.lightMode, ...patch } })),

    setWallCandidates: (wallCandidates) => set({ wallCandidates }),

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
