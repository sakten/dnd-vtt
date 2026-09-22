import { describe, expect, it } from 'vitest';
import type { CharacterSheet } from 'shared';
import { makeCombatRoom, makeToken } from '../test/fixtures';
import { makeConnCtx } from '../test/ctx';
import { availableChoiceRiders } from './attackRiders';
import { applyWeaponAttackDamage, resolveWeaponAttack, rollWeaponAttack, type WeaponAttackPlan } from './attackResolve';

/** Сид Math.random на время колбэка (броски детерминированы). */
function withRandom(value: number, fn: () => void): void {
  const original = Math.random;
  Math.random = () => value;
  try {
    fn();
  } finally {
    Math.random = original;
  }
}

const ATTACKS = {
  graze: { hit: 'd20+5', damage: '2d6+3', weaponKey: 'XPHB:Greatsword' },
  sap: { hit: 'd20+5', damage: '1d10+3', weaponKey: 'XPHB:Longsword' },
  vex: { hit: 'd20+5', damage: '1d6+3', weaponKey: 'XPHB:Handaxe' },
  slow: { hit: 'd20+5', damage: '1d6+3', weaponKey: 'XPHB:Javelin' },
  push: { hit: 'd20+5', damage: '1d8+3', weaponKey: 'XPHB:Greatclub' },
  topple: { hit: 'd20+5', damage: '1d8+3', weaponKey: 'XPHB:Battleaxe' },
  cleave: { hit: 'd20+5', damage: '1d12+3', weaponKey: 'XPHB:Greataxe' },
} as const;

type Kind = keyof typeof ATTACKS;

function setup(kind: Kind, opts: { str?: number; targetAc?: string; classes?: { className: string; level: number }[] } = {}) {
  const attack = {
    name: kind,
    ...ATTACKS[kind],
    rangeType: 'melee' as const,
    rangeNormal: 5,
    rangeLong: 0,
    damageType: 'slashing',
  };
  const attacker = makeToken('t1', { libraryItemId: 'lib1', isPlayerToken: true, x: 50, y: 100 });
  const target = makeToken('t2', { x: 100, y: 100, ac: opts.targetAc ?? '10', hpMax: '40', hpCurrent: 40 });
  const room = makeCombatRoom([attacker, target], { p1: 'lib1' });
  room.sheets['p1'] = {
    name: 'Воин',
    abilities: { str: opts.str ?? 16, dex: 14, con: 12, int: 10, wis: 10, cha: 8 },
    classes: opts.classes ?? [{ className: 'fighter', level: 1 }],
    attacks: [],
    spells: [],
    saves: {},
    skills: {},
    damageDefenses: [],
    senses: [],
    hpMax: '30',
    ac: '16',
    speed: 30,
  } as unknown as CharacterSheet;
  const f = makeConnCtx(room, { playerId: 'p1', dm: true, all: true });
  const strike = () =>
    resolveWeaponAttack(f.ctx, {
      attacker,
      attackerMapId: 'm1',
      target,
      targetMapId: 'm1',
      attack,
      author: 'A',
      ignoreRange: true,
    });
  return { attack, attacker, target, room, f, strike };
}

describe('мастерства оружия: Graze', () => {
  it('промах наносит урон, равный модификатору характеристики', () => {
    const { target, strike } = setup('graze', { targetAc: '30' });
    withRandom(0.5, () => strike());
    expect(target.hpCurrent).toBe(37);
  });

  it('нулевой модификатор — урона нет', () => {
    const { target, strike } = setup('graze', { targetAc: '30', str: 8 });
    withRandom(0.5, () => strike());
    expect(target.hpCurrent).toBe(40);
  });

  it('без класса с мастерствами Graze не работает', () => {
    const { target, strike } = setup('graze', { targetAc: '30', classes: [{ className: 'wizard', level: 5 }] });
    withRandom(0.5, () => strike());
    expect(target.hpCurrent).toBe(40);
  });
});

describe('мастерства оружия: Sap/Vex/Slow', () => {
  it('Sap: попадание накладывает одноразовую помеху на атаки цели', () => {
    const { target, strike } = setup('sap');
    withRandom(0.99, () => strike());
    const sap = target.effects.find((e) => e.sourceKey === 'mastery:Sap');
    expect(sap?.consumeOnAttackRoll).toBe(true);
    expect(sap?.modifiers.some((m) => m.mode === 'disadvantage' && m.filter?.direction === 'self')).toBe(true);
    expect(sap?.duration).toEqual({ type: 'endOfTurn', of: 'source' });
  });

  it('Vex: урон даёт преимущество по цели, эффект сгорает после следующей атаки', () => {
    const { attacker, target, strike } = setup('vex');
    withRandom(0.99, () => strike());
    const vex = attacker.effects.find((e) => e.sourceKey === 'mastery:Vex');
    expect(vex?.modifiers[0]?.filter).toMatchObject({ targetId: 't2', direction: 'self', weapon: true });
    expect(vex?.consumeOnAttackRoll).toBe(true);
    // Следующая атака (промах) сжигает метку и не накладывает заново.
    target.ac = '30';
    withRandom(0.5, () => strike());
    expect(attacker.effects.some((e) => e.sourceKey === 'mastery:Vex')).toBe(false);
  });

  it('Slow: урон снижает скорость цели на 10 до начала следующего хода', () => {
    const { target, strike } = setup('slow');
    withRandom(0.99, () => strike());
    const slow = target.effects.find((e) => e.sourceKey === 'mastery:Slow');
    expect(slow?.modifiers[0]).toMatchObject({ target: 'speed', mode: 'add', value: -10 });
    expect(slow?.duration).toEqual({ type: 'endOfTurn', of: 'source' });
  });
});

describe('мастерства по выбору: Push/Topple', () => {
  const planOf = (
    f: ReturnType<typeof setup>['f'],
    attacker: ReturnType<typeof setup>['attacker'],
    target: ReturnType<typeof setup>['target'],
    attack: ReturnType<typeof setup>['attack']
  ): WeaponAttackPlan => {
    let plan: WeaponAttackPlan | undefined;
    withRandom(0.99, () => {
      plan = rollWeaponAttack(f.ctx, {
        attacker,
        attackerMapId: 'm1',
        target,
        targetMapId: 'm1',
        attack,
        author: 'A',
        ignoreRange: true,
      }).plan;
    });
    if (!plan) throw new Error('нет плана атаки');
    return plan;
  };

  it('Push предлагается в окне выбора и толкает цель на 10 футов', () => {
    const { attack, attacker, target, f, room } = setup('push');
    const options = availableChoiceRiders(f.ctx, room, attacker, attack).map((r) => r.id);
    expect(options).toContain('mastery:Push');
    // Фикстура комнаты без размеров карты — толчку нужен прямоугольник.
    const map = room.scene.maps[0]!;
    map.width = 1000;
    map.height = 1000;
    const plan = planOf(f, attacker, target, attack);
    withRandom(0.5, () => applyWeaponAttackDamage(f.ctx, plan, { riders: ['mastery:Push'] }));
    expect(target.hpCurrent).toBeLessThan(40);
    expect(target.x).toBeGreaterThan(100);
  });

  it('Topple: провал спасброска — цель лежит (prone)', () => {
    const { attack, attacker, target, f } = setup('topple');
    const plan = planOf(f, attacker, target, attack);
    withRandom(0, () => applyWeaponAttackDamage(f.ctx, plan, { riders: ['mastery:Topple'] }));
    expect(target.conditions.some((c) => c.key === 'prone')).toBe(true);
  });

  it('Graze не предлагается как выбор (срабатывает сам)', () => {
    const { attack, attacker, f, room } = setup('graze');
    const options = availableChoiceRiders(f.ctx, room, attacker, attack).map((r) => r.id);
    expect(options).not.toContain('mastery:Graze');
  });
});

describe('мастерство Cleave', () => {
  it('попадание помечает вторую цель и оружие для «Прорубить»', () => {
    const { attacker, strike, f, room } = setup('cleave');
    withRandom(0.99, () => strike());
    const turn = f.ctx.manager.turnStateFor(room, 'm1', attacker);
    expect(turn?.cleaveFrom).toBe('t2');
    expect(turn?.cleaveWeapon).toBe('XPHB:Greataxe');
    expect(turn?.cleaveUsed).toBeUndefined();
  });

  it('вторая цель в 5 фт: урон без модификатора, раз в ход', () => {
    const { attack, attacker, strike, f, room } = setup('cleave');
    attacker.attacks = [attack] as CharacterSheet['attacks'];
    room.sheets['p1']!.attacks = attacker.attacks;
    const third = makeToken('t3', { x: 100, y: 50, ac: '10', hpMax: '30', hpCurrent: 30 });
    room.scene.maps[0]!.tokens.push(third);
    withRandom(0.99, () => strike());
    withRandom(0.5, () =>
      f.invoke('action:use', {
        mapId: 'm1',
        tokenId: 't1',
        actionId: 'attack',
        attackIndex: 0,
        cleave: true,
        targetIds: ['t3'],
      })
    );
    // 30 − урон: кость 1d12 (максимум 12) без +3 модификатора.
    const errors = f.emitted.filter((e) => e.event === 'chat:error').map((e) => e.payload);
    expect(errors).toEqual([]);
    expect(30 - third.hpCurrent).toBeLessThanOrEqual(12);
    expect(30 - third.hpCurrent).toBeGreaterThan(0);
    const turn = f.ctx.manager.turnStateFor(room, 'm1', attacker);
    expect(turn?.cleaveUsed).toBe(true);
    expect(turn?.cleaveFrom).toBeUndefined();
  });
});
