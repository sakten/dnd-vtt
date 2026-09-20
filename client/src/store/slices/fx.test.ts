import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiceRollResult, SpellFxPayload } from 'shared';
import { useGameStore } from '../useGameStore';
import { FX_STALE_MS, MAX_FX_QUEUE, fxStale } from './fx';

const payload = (patch: Partial<SpellFxPayload> = {}): SpellFxPayload => ({
  id: 'fx1',
  mapId: 'm1',
  casterId: 't1',
  key: 'XPHB:Fire Bolt',
  name: 'Fire Bolt',
  resolution: 'attack',
  mode: 'damage',
  attack: 'ranged',
  origin: null,
  direction: null,
  targets: ['t2'],
  types: ['fire'],
  count: 1,
  ...patch,
});

const roll = (dropped: number[]): DiceRollResult => ({
  expression: 'd20',
  dice: [{ sides: 20, values: [12], dropped, advantage: dropped.length ? 'a' : null, sign: 1 }],
  modifier: 0,
  total: 12,
  breakdown: '',
  damageParts: [],
});

describe('fx slice', () => {
  beforeEach(() => {
    useGameStore.setState({ rollAnim: null, fxQueue: [] });
  });

  it('без анимации кубика эффект стартует сразу', () => {
    const before = performance.now();
    useGameStore.getState().onFxPlay(payload());
    const queued = useGameStore.getState().fxQueue[0]!;
    expect(queued.id).toBe('fx1');
    expect(queued.notBefore - before).toBeLessThan(20);
  });

  it('во время d20 эффект ждёт конца анимации', () => {
    useGameStore.getState().onRollAnim({ id: 'r1', roll: roll([]) });
    useGameStore.getState().onFxPlay(payload());
    const queued = useGameStore.getState().fxQueue[0]!;
    expect(queued.notBefore).toBeGreaterThan(performance.now() + 1000);
  });

  it('dequeueFx убирает эффект из очереди', () => {
    useGameStore.getState().onFxPlay(payload());
    useGameStore.getState().onFxPlay(payload({ id: 'fx2' }));
    useGameStore.getState().dequeueFx('fx1');
    expect(useGameStore.getState().fxQueue.map((f) => f.id)).toEqual(['fx2']);
  });

  it('clearFxQueue очищает очередь (вкладка в фоне)', () => {
    useGameStore.getState().onFxPlay(payload());
    useGameStore.getState().onFxPlay(payload({ id: 'fx2' }));
    useGameStore.getState().clearFxQueue();
    expect(useGameStore.getState().fxQueue).toEqual([]);
  });

  it('fxStale: старые эффекты пропускаются, свежие играются', () => {
    const fx = { ...payload(), notBefore: 1000, queuedAt: 1000 };
    expect(fxStale(fx, 1000 + FX_STALE_MS - 1)).toBe(false);
    expect(fxStale(fx, 1000 + FX_STALE_MS + 1)).toBe(true);
  });

  it('в фоновой вкладке эффекты не копятся', () => {
    vi.stubGlobal('document', { hidden: true });
    useGameStore.getState().onFxPlay(payload());
    expect(useGameStore.getState().fxQueue).toEqual([]);
    vi.unstubAllGlobals();
    useGameStore.getState().onFxPlay(payload());
    expect(useGameStore.getState().fxQueue).toHaveLength(1);
  });

  it('очередь ограничена: при переполнении отбрасывается старейший', () => {
    for (let i = 0; i < MAX_FX_QUEUE + 3; i++) {
      useGameStore.getState().onFxPlay(payload({ id: `fx${i}` }));
    }
    const ids = useGameStore.getState().fxQueue.map((f) => f.id);
    expect(ids).toHaveLength(MAX_FX_QUEUE);
    expect(ids[0]).toBe('fx3');
    expect(ids[ids.length - 1]).toBe(`fx${MAX_FX_QUEUE + 2}`);
  });
});
