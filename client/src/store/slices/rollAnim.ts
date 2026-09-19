import { emit } from '../helpers';
import type { DiceRollFace } from '../../components/ThreeD20';
import type { GameState, Slice } from '../types';

type RollAnimState = Pick<GameState, 'rollAnim' | 'onRollAnim' | 'setRollAnimChance' | 'clearRollAnim'>;

export const createRollAnimSlice: Slice<RollAnimState> = (set, get) => {
  return {
    rollAnim: null,

    // Сервер уже бросил: показываем анимацию на выпавших значениях.
    // Преимущество/помеха — два d20: взятый подсвечивается, отброшенный тускнеет.
    onRollAnim: ({ id, roll }) => {
      const group = roll.dice.find((d) => d.sides === 20 && d.sign === 1);
      const dice: DiceRollFace[] = group
        ? [
            ...group.values.map((value) => ({ value, kept: true })),
            ...group.dropped.map((value) => ({ value, kept: false })),
          ]
        : [{ value: roll.total, kept: true }];
      set({ rollAnim: { id, dice, startedAt: performance.now() } });
    },

    setRollAnimChance: (value) => {
      emit(get, 'player:rollAnimChance', { value });
    },

    clearRollAnim: () => set({ rollAnim: null }),
  };
};
