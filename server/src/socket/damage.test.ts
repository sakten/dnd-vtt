import { describe, expect, it } from 'vitest';
import { makeConnCtx } from '../test/ctx';
import { makeRoom, makeToken } from '../test/fixtures';
import { applyDamage } from './damage';

function setup(defenses: { id: string; type: 'resistance' | 'immunity' | 'vulnerability'; damageType: string }[]) {
  const target = makeToken('t1', { hpMax: '50', hpCurrent: 50, damageDefenses: defenses });
  const room = makeRoom();
  room.scene.maps[0]!.tokens.push(target);
  const { ctx } = makeConnCtx(room, { dm: true });
  return { target, ctx };
}

describe('applyDamage: составной урон', () => {
  it('иммунитет к огню режет только огненную часть', () => {
    const { target, ctx } = setup([{ id: 'd1', type: 'immunity', damageType: 'fire' }]);
    const result = applyDamage(ctx, {
      target,
      mapId: 'm1',
      amount: 18,
      damageType: 'slashing',
      parts: [
        { damageType: 'slashing', amount: 13 },
        { damageType: 'fire', amount: 5 },
      ],
    });
    expect(result.amount).toBe(13);
    expect(target.hpCurrent).toBe(37);
  });

  it('части без типа наследуют основной тип атаки', () => {
    const { target, ctx } = setup([{ id: 'd1', type: 'resistance', damageType: 'slashing' }]);
    const result = applyDamage(ctx, {
      target,
      mapId: 'm1',
      amount: 11,
      damageType: 'slashing',
      parts: [{ amount: 11 }],
    });
    expect(result.amount).toBe(5);
    expect(target.hpCurrent).toBe(45);
  });

  it('сопротивление считается по каждой части отдельно', () => {
    const { target, ctx } = setup([{ id: 'd1', type: 'resistance', damageType: 'fire' }]);
    const result = applyDamage(ctx, {
      target,
      mapId: 'm1',
      amount: 18,
      damageType: 'slashing',
      parts: [
        { damageType: 'slashing', amount: 13 },
        { damageType: 'fire', amount: 5 },
      ],
    });
    expect(result.amount).toBe(15);
    expect(target.hpCurrent).toBe(35);
  });
});
