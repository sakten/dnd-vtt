import { describe, expect, it } from 'vitest';
import { WEAPONS, type AbilityKey } from 'shared';
import { makeCombatRoom, makeToken } from '../test/fixtures';
import { makeConnCtx } from '../test/ctx';
import { attackDamageRoll, attackHitRoll, attackUnseen, prepareWeaponAttack, resolveWeaponAttack } from './attackResolve';

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

describe('attackUnseen', () => {
  it('стена между участниками — оба не видят друг друга', () => {
    const attacker = makeToken('a', { x: 50, y: 100 });
    const target = makeToken('t', { x: 150, y: 100 });
    const room = makeCombatRoom([attacker, target]);
    const map = room.scene.maps[0]!;
    map.walls = [{ id: 'w1', x1: 100, y1: 0, x2: 100, y2: 200, kind: 'wall', open: false }];

    expect(attackUnseen(room, attacker, target, map)).toEqual({ unseenTarget: true, unseenAttacker: true });

    map.walls = [];
    expect(attackUnseen(room, attacker, target, map)).toEqual({ unseenTarget: false, unseenAttacker: false });
  });

  it('«Темнота»: свет заклинания (Daylight) снимает невидимость', () => {
    const attacker = makeToken('a', { x: 50, y: 100 });
    const target = makeToken('t', { x: 150, y: 100 });
    const room = makeCombatRoom([attacker, target]);
    const map = room.scene.maps[0]!;
    map.vision = { los: false, darkness: true };

    expect(attackUnseen(room, attacker, target, map)).toEqual({ unseenTarget: true, unseenAttacker: true });

    target.effects = [
      {
        id: 'l1',
        name: 'Daylight',
        duration: { type: 'rounds', rounds: 600 },
        modifiers: [],
        light: { bright: 60, dim: 60 },
      },
    ];
    expect(attackUnseen(room, attacker, target, map)).toEqual({ unseenTarget: false, unseenAttacker: false });
  });
});

describe('attackHitRoll', () => {
  it('штраф-истощение и нат. 20: попадание и крит', () => {
    withRandom(0.999, () => {
      const hit = attackHitRoll({
        attackExpr: 'd20+0',
        advCount: 0,
        disCount: 0,
        penalty: -5,
        critMin: 20,
        targetAc: 25,
      });
      expect(hit.hitRoll.total).toBe(20);
      expect(hit.crit).toBe(true);
      expect(hit.hitSuccess).toBe(true); // 20 - 5 = 15 < 25, но крит = попадание
    });
  });

  it('AC неизвестен — попадание не проверяется', () => {
    withRandom(0.5, () => {
      const hit = attackHitRoll({
        attackExpr: 'd20+2',
        advCount: 0,
        disCount: 0,
        penalty: 0,
        critMin: 20,
        targetAc: 0,
      });
      expect(hit.hitSuccess).toBeUndefined();
      expect(hit.crit).toBe(false);
    });
  });
});

describe('attackDamageRoll', () => {
  it('крит удваивает кости урона', () => {
    withRandom(0.5, () => {
      expect(attackDamageRoll('1d6', undefined, false).total).toBe(4);
      expect(attackDamageRoll('1d6', undefined, true).total).toBe(8);
    });
  });
});

describe('оружие: граница ошибок', () => {
  const attack = (damage: string) => ({
    name: 'Меч',
    hit: 'd20+5',
    damage,
    rangeType: 'melee' as const,
    rangeNormal: 5,
    rangeLong: 0,
    damageType: 'slashing',
  });

  const setup = (damage: string) => {
    const entry = attack(damage);
    const attacker = makeToken('t1', { x: 50, y: 100, attacks: [entry] });
    const target = makeToken('t2', { x: 100, y: 100, ac: '15', hpMax: '20', hpCurrent: 20 });
    const room = makeCombatRoom([attacker, target]);
    return { entry, attacker, target, room };
  };

  it('битая формула урона: badRoll до броска попадания, состояние не тронуто', () => {
    const { entry, attacker, target, room } = setup('abc');
    const f = makeConnCtx(room, { dm: true });
    const result = resolveWeaponAttack(f.ctx, {
      attacker,
      attackerMapId: 'm1',
      target,
      targetMapId: 'm1',
      attack: entry,
      author: 'A',
      ignoreRange: true,
    });

    expect(result.hitRoll).toBeUndefined();
    expect(result.damageRoll).toBeUndefined();
    expect(f.selfEvents('chat:error')[0]?.payload).toEqual({ code: 'badRoll' });
    expect(attacker.effects).toEqual([]);
    expect(target.hpCurrent).toBe(20);
  });

  it('внутренняя ошибка пробрасывается, а не превращается в badRoll', () => {
    const { entry, attacker, target, room } = setup('1d8+3');
    const f = makeConnCtx(room, {
      dm: true,
      overrides: {
        applyHp: () => {
          throw new TypeError('boom');
        },
      },
    });

    withRandom(0.999, () => {
      expect(() =>
        resolveWeaponAttack(f.ctx, {
          attacker,
          attackerMapId: 'm1',
          target,
          targetMapId: 'm1',
          attack: entry,
          author: 'A',
          ignoreRange: true,
        })
      ).toThrow(TypeError);
    });
  });
});

describe('Heavy: помеха по профильной характеристике', () => {
  const heavy = WEAPONS.find((w) => w.rangeType === 'melee' && w.properties.includes('H'))!;
  const entry = {
    name: heavy.name,
    hit: 'd20+5',
    damage: '1d10',
    rangeType: 'melee' as const,
    rangeNormal: 5,
    rangeLong: 0,
    damageType: 'slashing',
    weaponKey: heavy.key,
  };

  const disFor = (str: number, dex: number): number => {
    const abilities: Record<AbilityKey, number> = { str, dex, con: 10, int: 10, wis: 10, cha: 10 };
    const attacker = makeToken('t1', { x: 50, y: 100, statblock: { abilities } });
    const target = makeToken('t2', { x: 100, y: 100 });
    const room = makeCombatRoom([attacker, target]);
    const f = makeConnCtx(room, { dm: true });
    const { prep } = prepareWeaponAttack(f.ctx, {
      attacker,
      attackerMapId: 'm1',
      target,
      targetMapId: 'm1',
      attack: entry,
      author: 'A',
    });
    return prep!.disCount;
  };

  it('Сила ≤ 12 — помеха, Сила 13 — без помехи', () => {
    expect(disFor(12, 14)).toBe(1);
    expect(disFor(13, 8)).toBe(0);
  });
});

describe('Magic Weapon: магический физурон обходит защиту «nonmagical»', () => {
  const entry = {
    name: 'Меч',
    hit: 'd20+5',
    damage: '1d8',
    rangeType: 'melee' as const,
    rangeNormal: 5,
    rangeLong: 0,
    damageType: 'slashing',
  };

  const remainingHp = (magic: boolean): number => {
    const attacker = makeToken('t1', { x: 50, y: 100, attacks: [entry] });
    const target = makeToken('t2', {
      x: 100,
      y: 100,
      ac: '15',
      hpMax: '30',
      hpCurrent: 30,
      damageDefenses: [{ id: 'd1', type: 'resistance', damageType: 'slashing' }],
    });
    const room = makeCombatRoom([attacker, target]);
    if (magic) {
      attacker.effects = [
        { id: 'mw', name: 'Magic Weapon', duration: { type: 'permanent' }, modifiers: [], magicWeapon: true },
      ];
    }
    const f = makeConnCtx(room, { dm: true });
    withRandom(0.5, () => {
      resolveWeaponAttack(f.ctx, {
        attacker,
        attackerMapId: 'm1',
        target,
        targetMapId: 'm1',
        attack: entry,
        author: 'A',
        ignoreRange: true,
      });
    });
    return target.hpCurrent;
  };

  it('без эффекта сопротивление режет урон вдвое, с эффектом — полный урон', () => {
    expect(remainingHp(false)).toBe(28);
    expect(remainingHp(true)).toBe(25);
  });
});

describe('модификаторы урона с фильтром weapon (Divine Favor, Magic Weapon)', () => {
  const entry = {
    name: 'Меч',
    hit: 'd20+5',
    damage: '1d8',
    rangeType: 'melee' as const,
    rangeNormal: 5,
    rangeLong: 0,
    damageType: 'slashing',
  };
  const unarmedEntry = {
    name: 'Безоружный удар',
    kind: 'unarmed' as const,
    hit: 'd20+5',
    damage: '1d8',
    rangeType: 'melee' as const,
    rangeNormal: 5,
    rangeLong: 0,
    damageType: 'bludgeoning',
  };

  const attackWith = (
    modifiers: { target: 'attack' | 'damage'; mode: 'add'; value: number | string; filter: { weapon: boolean; unarmed?: boolean } }[],
    attackEntry: typeof entry = entry
  ) => {
    const attacker = makeToken('t1', { x: 50, y: 100, attacks: [attackEntry] });
    const target = makeToken('t2', { x: 100, y: 100, ac: '15', hpMax: '30', hpCurrent: 30 });
    const room = makeCombatRoom([attacker, target]);
    attacker.effects = [
      { id: 'e1', name: 'Бафф', duration: { type: 'permanent' }, modifiers: modifiers.map((m, i) => ({ ...m, id: `e1:m${i}` })) },
    ];
    const f = makeConnCtx(room, { dm: true });
    withRandom(0.5, () => {
      resolveWeaponAttack(f.ctx, {
        attacker,
        attackerMapId: 'm1',
        target,
        targetMapId: 'm1',
        attack: attackEntry,
        author: 'A',
        ignoreRange: true,
      });
    });
    return target.hpCurrent;
  };

  const divineFavor = [
    { target: 'damage' as const, mode: 'add' as const, value: '1d4radiant', filter: { weapon: true, unarmed: false } },
  ];

  it('Divine Favor: +1d4 излучением добавляется к урону оружия', () => {
    // 1d8=5 режущим + 1d4=3 излучением → 30 − 8 = 22.
    expect(attackWith(divineFavor)).toBe(22);
  });

  it('Divine Favor: безоружный удар бонус не получает (фильтр unarmed: false)', () => {
    // 1d8=5 дробящим без райдера → 30 − 5 = 25.
    expect(attackWith(divineFavor, unarmedEntry)).toBe(25);
  });

  it('Magic Weapon: +1 к урону прибавляется к броску', () => {
    // 1d8=5 + 1 → 30 − 6 = 24.
    expect(
      attackWith([
        { target: 'attack', mode: 'add', value: 1, filter: { weapon: true, unarmed: false } },
        { target: 'damage', mode: 'add', value: 1, filter: { weapon: true, unarmed: false } },
      ])
    ).toBe(24);
  });
});

describe('Invisibility: бросок атаки обрывает эффект', () => {
  it('после атаки снимаются эффект с breakOn и его условие', () => {
    const entry = {
      name: 'Меч',
      hit: 'd20+5',
      damage: '1d8',
      rangeType: 'melee' as const,
      rangeNormal: 5,
      rangeLong: 0,
      damageType: 'slashing',
    };
    const attacker = makeToken('t1', { x: 50, y: 100, attacks: [entry] });
    const target = makeToken('t2', { x: 100, y: 100, ac: '15', hpMax: '30', hpCurrent: 30 });
    const room = makeCombatRoom([attacker, target]);
    attacker.effects = [
      {
        id: 'inv',
        name: 'Invisibility',
        sourceKey: 'XPHB:Invisibility',
        sourceId: 't1',
        concentration: true,
        duration: { type: 'permanent' },
        modifiers: [],
        conditions: ['invisible'],
        breakOn: ['attack', 'spell'],
      },
    ];
    attacker.conditions = [{ key: 'invisible', name: 'Невидим', rounds: null, effectId: 'inv' }];
    const f = makeConnCtx(room, { dm: true });

    withRandom(0.5, () => {
      resolveWeaponAttack(f.ctx, {
        attacker,
        attackerMapId: 'm1',
        target,
        targetMapId: 'm1',
        attack: entry,
        author: 'A',
        ignoreRange: true,
      });
    });

    expect(attacker.effects.some((e) => e.breakOn?.includes('attack'))).toBe(false);
    expect(attacker.conditions.some((c) => c.key === 'invisible')).toBe(false);
  });
});

describe('Spirit Shroud: доп. урон по цели под аурой кастера', () => {
  const entry = {
    name: 'Меч',
    hit: 'd20+5',
    damage: '1d8',
    rangeType: 'melee' as const,
    rangeNormal: 5,
    rangeLong: 0,
    damageType: 'slashing',
  };

  const strike = (sourceId: string): number => {
    const attacker = makeToken('t1', { x: 50, y: 100, attacks: [entry] });
    const target = makeToken('t2', { x: 100, y: 100, ac: '15', hpMax: '30', hpCurrent: 30 });
    const room = makeCombatRoom([attacker, target]);
    target.effects = [
      {
        id: 'ss',
        name: 'Spirit Shroud',
        sourceKey: 'TCE:Spirit Shroud',
        sourceId,
        duration: { type: 'permanent' },
        modifiers: [],
        takesExtraDamage: { dice: '1d8', damageType: 'cold' },
      },
    ];
    const f = makeConnCtx(room, { dm: true });
    withRandom(0.5, () => {
      resolveWeaponAttack(f.ctx, {
        attacker,
        attackerMapId: 'm1',
        target,
        targetMapId: 'm1',
        attack: entry,
        author: 'A',
        ignoreRange: true,
      });
    });
    return target.hpCurrent;
  };

  it('атака кастера-источника бьёт +1d8 холодом', () => {
    // 1d8=5 рубящим + 1d8=5 холодом → 30 − 10 = 20.
    expect(strike('t1')).toBe(20);
  });

  it('эффект чужого источника доп. урон не даёт', () => {
    expect(strike('t9')).toBe(25);
  });
});

describe('Flame Arrows: заряды боеприпасов', () => {
  const entry = {
    name: 'Лук',
    hit: 'd20+5',
    damage: '1d8',
    rangeType: 'ranged' as const,
    rangeNormal: 80,
    rangeLong: 320,
    damageType: 'piercing',
  };

  it('−1 за дальнобойную атаку, на нуле эффект гаснет', () => {
    const attacker = makeToken('t1', { x: 50, y: 100, attacks: [entry] });
    const target = makeToken('t2', { x: 150, y: 100, ac: '15', hpMax: '40', hpCurrent: 40 });
    const room = makeCombatRoom([attacker, target]);
    attacker.effects = [
      {
        id: 'fa',
        name: 'Flame Arrows',
        sourceKey: 'XGE:Flame Arrows',
        sourceId: 't2',
        duration: { type: 'permanent' },
        modifiers: [
          {
            id: 'fa:m',
            target: 'damage',
            mode: 'add',
            value: '1d6fire',
            filter: { weapon: true, unarmed: false, attackType: 'ranged' },
          },
        ],
        charges: { remaining: 2, on: 'rangedWeaponAttack' },
      },
    ];
    const f = makeConnCtx(room, { dm: true });
    // 1d8=5 колющим + 1d6=4 огнём → 40 − 9 = 31; заряд 2 → 1.
    withRandom(0.5, () => {
      resolveWeaponAttack(f.ctx, {
        attacker,
        attackerMapId: 'm1',
        target,
        targetMapId: 'm1',
        attack: entry,
        author: 'A',
        ignoreRange: true,
      });
    });
    expect(target.hpCurrent).toBe(31);
    expect(attacker.effects[0]?.charges?.remaining).toBe(1);

    withRandom(0.5, () => {
      resolveWeaponAttack(f.ctx, {
        attacker,
        attackerMapId: 'm1',
        target,
        targetMapId: 'm1',
        attack: entry,
        author: 'A',
        ignoreRange: true,
      });
    });
    expect(attacker.effects.some((e) => e.name === 'Flame Arrows')).toBe(false);
  });
});
