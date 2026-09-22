import { describe, expect, it } from 'vitest';
import { makeConnCtx } from '../test/ctx';
import { makeRoom, makeToken } from '../test/fixtures';
import { applyDamage } from './damage';

function setup(defenses: { id: string; type: 'resistance' | 'immunity' | 'vulnerability'; damageType: string }[]) {
  const target = makeToken('t1', { hpMax: '50', hpCurrent: 50, damageDefenses: defenses });
  const room = makeRoom();
  room.scene.maps[0]!.tokens.push(target);
  const f = makeConnCtx(room, { dm: true });
  return { target, f, ctx: f.ctx };
}

const laughter = (dc: number) =>
  ({
    id: 'ef1',
    name: 'Hideous Laughter',
    duration: { type: 'untilSave', ability: 'wis', dc, timing: 'end' } as const,
    modifiers: [],
    saveOnDamage: { advantage: true },
  });

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

describe('повторный спасбросок от урона (Hideous Laughter)', () => {
  it('провал сейва оставляет эффект, бросок идёт с преимуществом', () => {
    const { target, f, ctx } = setup([]);
    target.effects.push(laughter(100));
    applyDamage(ctx, { target, mapId: 'm1', amount: 5, damageType: 'slashing' });
    expect(target.effects).toHaveLength(1);
    const msg = f.emitted.find((e) => e.event === 'chat:message')!.payload as {
      roll?: { dice?: { advantage?: string | null }[] };
    };
    expect(msg.roll?.dice?.[0]?.advantage).toBe('a');
  });

  it('успех снимает эффект и его состояния', () => {
    const { target, f, ctx } = setup([]);
    target.effects.push(laughter(0));
    target.conditions.push({ key: 'incapacitated', name: 'Недееспособен', rounds: null, effectId: 'ef1' });
    applyDamage(ctx, { target, mapId: 'm1', amount: 5, damageType: 'slashing' });
    expect(target.effects).toHaveLength(0);
    expect(target.conditions).toHaveLength(0);
    const msg = f.emitted.find((e) => e.event === 'chat:message')!.payload as { labelParams?: { saveOutcome?: string } };
    expect(msg.labelParams?.saveOutcome).toBe('success');
  });
});
