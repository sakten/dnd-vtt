import type { SpellFxPayload } from 'shared';
import { rollAnimMs } from '../../lib/rollAnimTiming';
import type { FxCast, GameState, Slice } from '../types';

type FxState = Pick<GameState, 'fxQueue' | 'onFxPlay' | 'dequeueFx' | 'clearFxQueue'>;

/** Эффект, пролежавший в очереди дольше (фоновая вкладка/тормоза), не проигрываем. */
export const FX_STALE_MS = 2000;

/** Потолок очереди: FX — косметика «здесь и сейчас», лишнее (старейшее) отбрасываем. */
export const MAX_FX_QUEUE = 4;

/** Пора ли пропустить эффект: он старше окна свежести. */
export function fxStale(fx: Pick<FxCast, 'queuedAt'>, now: number): boolean {
  return now - fx.queuedAt > FX_STALE_MS;
}

export const createFxSlice: Slice<FxState> = (set, get) => {
  return {
    fxQueue: [],

    // Косметический эффект применения. Если у нас катится d20 (событие `roll:anim`
    // приходит перед `fx:play` тем же сокетом с той же атаки) — ждём его конца.
    onFxPlay: (payload: SpellFxPayload) => {
      // Фон: не копим вовсе — при возврате эффекты уже неактуальны.
      if (typeof document !== 'undefined' && document.hidden) return;
      const now = performance.now();
      const anim = get().rollAnim;
      const left = anim ? Math.max(0, rollAnimMs(anim.dice) - (now - anim.startedAt)) : 0;
      set((s) => {
        const queue = [...s.fxQueue, { ...payload, notBefore: now + left, queuedAt: now }];
        return { fxQueue: queue.length > MAX_FX_QUEUE ? queue.slice(queue.length - MAX_FX_QUEUE) : queue };
      });
    },

    dequeueFx: (id) => set((s) => ({ fxQueue: s.fxQueue.filter((f) => f.id !== id) })),

    clearFxQueue: () => set({ fxQueue: [] }),
  };
};
