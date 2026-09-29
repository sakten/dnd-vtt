import { afterEach, describe, expect, it, vi } from 'vitest';
import { triggerOn, type EffectInstance, type Token } from 'shared';
import { makeConnCtx } from '../test/ctx';
import { makeRoom as makePlainRoom, makeToken } from '../test/fixtures';
import type { Room } from '../roomTypes';
import { afterDamage, beforeDamage, gateAttackOnTarget, type DamageEvent } from './triggers';

afterEach(() => vi.restoreAllMocks());

const effect = (patch: Partial<EffectInstance> = {}): EffectInstance => ({
  id: 'e1',
  name: 'Тест',
  duration: { type: 'permanent' },
  modifiers: [],
  ...patch,
});

const roomWith = (tokens: Token[], effects: Record<string, EffectInstance[]> = {}): Room => {
  const room = makePlainRoom();
  room.scene.maps[0]!.tokens = tokens;
  for (const token of tokens) token.effects = effects[token.id] ?? token.effects;
  return room;
};

const damageEvent = (patch: Partial<DamageEvent> = {}): DamageEvent => ({
  target: makeToken('t2'),
  mapId: 'm1',
  defenses: [],
  groups: [{ amount: 10, damageType: 'fire' }],
  groupTypes: ['fire'],
  amount: 10,
  hpBefore: 30,
  tempBefore: 0,
  ...patch,
});

describe('gateAttackOnTarget (targetedByAttack)', () => {
  it('провал спаса блокирует атаку и сообщает в чат', () => {
    const attacker = makeToken('a', { statblock: { abilities: { wis: 1 } } as never });
    const warded = makeToken('t2', {
      effects: [effect({ triggers: [{ on: 'targetedByAttack', save: { ability: 'wis', dc: 30 } }] })],
    });
    const room = roomWith([attacker, warded]);
    const f = makeConnCtx(room, { dm: true });

    expect(gateAttackOnTarget(f.ctx, room, attacker, warded)).toBe(true);
    expect(
      f.emitted.some((e) => e.event === 'chat:message' && JSON.stringify(e.payload).includes('automation.sanctuary'))
    ).toBe(true);
  });

  it('успешный спас пропускает атаку; без триггера/по себе — не блокирует', () => {
    const attacker = makeToken('a', { statblock: { abilities: { wis: 20 } } as never });
    const warded = makeToken('t2', {
      effects: [effect({ triggers: [{ on: 'targetedByAttack', save: { ability: 'wis', dc: 1 } }] })],
    });
    const plain = makeToken('t3');
    const room = roomWith([attacker, warded, plain]);
    const f = makeConnCtx(room, { dm: true });

    expect(gateAttackOnTarget(f.ctx, room, attacker, warded)).toBe(false);
    expect(gateAttackOnTarget(f.ctx, room, attacker, plain)).toBe(false);
    expect(gateAttackOnTarget(f.ctx, room, attacker, attacker)).toBe(false);
  });
});

describe('beforeDamage (фаза damaged до HP)', () => {
  it('Resistance снижает урон на кость и тратит заряд', () => {
    const target = makeToken('t1', {
      effects: [
        effect({
          charges: { remaining: 1 },
          triggers: [{ on: 'damaged', reduce: { dice: '1d4', types: ['fire'] } }],
        }),
      ],
    });
    const room = roomWith([target]);
    const f = makeConnCtx(room, { dm: true });
    const e = damageEvent({ target });

    vi.spyOn(Math, 'random').mockReturnValue(0.5); // d4 = 3
    beforeDamage(f.ctx, room, e);

    expect(e.amount).toBe(7);
    expect(target.effects[0]!.charges!.remaining).toBe(0);
    expect(
      f.emitted.some((x) => x.event === 'chat:message' && JSON.stringify(x.payload).includes('automation.damageReduce'))
    ).toBe(true);
  });

  it('Elemental Bane добавляет кости раз в ход и ставит метку хода', () => {
    const target = makeToken('t1', {
      effects: [
        effect({
          triggers: [{ on: 'damaged', extraDamage: { dice: '2d6', damageType: 'fire', oncePerTurn: true } }],
        }),
      ],
    });
    const room = roomWith([target]);
    const f = makeConnCtx(room, { dm: true });
    const e = damageEvent({ target });

    vi.spyOn(Math, 'random').mockReturnValue(0.5); // 2d6 = 4 + 4
    beforeDamage(f.ctx, room, e);

    expect(e.amount).toBe(18);
    expect(triggerOn(target.effects[0]!, 'damaged')?.usedTurn).toBeNull();
  });

  it('unreducible пропускает снижение', () => {
    const target = makeToken('t1', {
      effects: [effect({ charges: { remaining: 1 }, triggers: [{ on: 'damaged', reduce: { dice: '1d4', types: ['fire'] } }] })],
    });
    const room = roomWith([target]);
    const f = makeConnCtx(room, { dm: true });
    const e = damageEvent({ target, unreducible: true });

    beforeDamage(f.ctx, room, e);

    expect(e.amount).toBe(10);
    expect(target.effects[0]!.charges!.remaining).toBe(1);
  });
});

describe('afterDamage (фаза damaged после HP)', () => {
  it('Warding Bond переносит урон источнику и обрывает ownDamageDealt атакующего', () => {
    const caster = makeToken('t1', { x: 50, y: 100, hpMax: '30', hpCurrent: 30 });
    const target = makeToken('t2', { x: 100, y: 100, hpMax: '30', hpCurrent: 30 });
    const attacker = makeToken('t3', {
      x: 100,
      y: 150,
      effects: [effect({ triggers: [{ on: 'ownDamageDealt', endEffect: true }] })],
    });
    target.effects = [
      effect({ id: 'bond', sourceId: caster.id, triggers: [{ on: 'damaged', redirect: 'linked' }] }),
    ];
    const room = roomWith([caster, target, attacker]);
    const f = makeConnCtx(room, { dm: true });

    afterDamage(f.ctx, room, damageEvent({ target, attacker, amount: 7 }));

    // Урон цели уже применён HP-пайплайном до фазы `after`; фаза переносит его источнику.
    expect(target.hpCurrent).toBe(30);
    expect(caster.hpCurrent).toBe(23);
    expect(attacker.effects).toHaveLength(0);
  });
});

describe('Death Ward-контракт остается в HP-пайплайне', () => {
  it('ручная правка HP не зажигает hpReachedZero (gate на damageEvent)', () => {
    const tk = makeToken('t1', {
      hpMax: '30',
      hpCurrent: 10,
      effects: [effect({ triggers: [{ on: 'hpReachedZero', survive: { hp: 1 } }] })],
    });
    const room = roomWith([tk]);
    const f = makeConnCtx(room, { dm: true });

    f.ctx.applyHp(room, 'm1', tk, -30);

    expect(tk.hpCurrent).toBe(-20);
    expect(tk.effects).toHaveLength(1);
  });
});
