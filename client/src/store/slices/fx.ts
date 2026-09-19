import type { SpellFxPayload } from 'shared';
import { rollAnimMs } from '../../lib/rollAnimTiming';
import type { GameState, Slice } from '../types';

type FxState = Pick<GameState, 'fxQueue' | 'onFxPlay' | 'dequeueFx'>;

export const createFxSlice: Slice<FxState> = (set, get) => {
  return {
    fxQueue: [],

    // Косметический эффект применения. Если у нас катится d20 (событие `roll:anim`
    // приходит перед `fx:play` тем же сокетом с той же атаки) — ждём его конца.
    onFxPlay: (payload: SpellFxPayload) => {
      const now = performance.now();
      const anim = get().rollAnim;
      const left = anim ? Math.max(0, rollAnimMs(anim.dice) - (now - anim.startedAt)) : 0;
      set((s) => ({ fxQueue: [...s.fxQueue, { ...payload, notBefore: now + left }] }));
    },

    dequeueFx: (id) => set((s) => ({ fxQueue: s.fxQueue.filter((f) => f.id !== id) })),
  };
};
