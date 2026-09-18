import type { GameState, Slice } from '../types';

type RollModeState = Pick<GameState, 'rollMode' | 'setRollMode'>;

/** Галка Adv/Dis над ROLL: действует на следующий бросок, включая чеки в игре. */
export const createRollModeSlice: Slice<RollModeState> = (set) => {
  return {
    rollMode: null,
    setRollMode: (mode) => set({ rollMode: mode }),
  };
};
