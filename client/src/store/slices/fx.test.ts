import { beforeEach, describe, expect, it } from 'vitest';
import type { DiceRollResult, SpellFxPayload } from 'shared';
import { useGameStore } from '../useGameStore';

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
});
