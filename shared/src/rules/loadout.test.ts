import { describe, expect, it } from 'vitest';
import type { CharacterSheet } from '../domain/sheet';
import type { EffectInstance } from '../domain/effects';
import type { AttackEntry } from '../domain/token';
import { HANDS_SHIELD } from './hands';
import { applyWeaponOverrides, handOf, loadoutOf, weaponContextOf } from './loadout';

const sword: AttackEntry = {
  id: 'sw',
  name: 'Меч',
  hit: 'd20+str',
  damage: '1d8+str',
  rangeType: 'melee',
  rangeNormal: 5,
  rangeLong: 0,
};
const knife: AttackEntry = {
  id: 'kn',
  name: 'Кинжал',
  hit: 'd20+dex',
  damage: '1d4+dex',
  rangeType: 'melee',
  rangeNormal: 5,
  rangeLong: 0,
};

describe('loadoutOf', () => {
  it('без эффектов возвращает исходный список и руки (fast path)', () => {
    const attacks = [sword, knife];
    const hands = { right: 'sw', left: 'kn' };
    const loadout = loadoutOf({ attacks, hands });
    expect(loadout.attacks).toBe(attacks);
    expect(loadout.hands).toBe(hands);
  });

  it('пустой ввод — пустой список', () => {
    expect(loadoutOf({}).attacks).toEqual([]);
    expect(loadoutOf({}).hands).toBeUndefined();
  });
});

describe('Shillelagh (weaponOverride)', () => {
  const club: AttackEntry = {
    id: 'club',
    name: 'Палица',
    hit: 'd20+2',
    damage: '1d4',
    damageType: 'bludgeoning',
    rangeType: 'melee',
    rangeNormal: 5,
    rangeLong: 0,
    weaponKey: 'XPHB:Club',
  };
  const shillelagh: EffectInstance = {
    id: 'sh',
    name: 'Shillelagh',
    sourceKey: 'XPHB:Shillelagh',
    duration: { type: 'permanent' },
    modifiers: [],
    weaponOverride: { weapons: ['XPHB:Club', 'XPHB:Quarterstaff'], dice: '1d12', damageType: 'force', abilityMod: 4 },
  };
  const ctx = { abilities: {}, classes: [{ className: 'druid', level: 5 }] };

  it('меняет кость, тип и характеристику клуба (ПБ + заклинательная)', () => {
    const loadout = loadoutOf({ attacks: [club, sword], effects: [shillelagh], ...ctx });
    expect(loadout.attacks[0]).toMatchObject({ hit: 'd20+7', damage: '1d12+4', damageType: 'force' });
    expect(loadout.attacks[1]).toBe(sword);
  });

  it('другое оружие и безоружный удар не трогает', () => {
    expect(applyWeaponOverrides(sword, [shillelagh], ctx)).toBe(sword);
    const unarmed: AttackEntry = { ...sword, weaponKey: undefined, kind: 'unarmed' };
    expect(applyWeaponOverrides(unarmed, [shillelagh], ctx)).toBe(unarmed);
  });

  it('вторая рука — урон без модификатора', () => {
    expect(applyWeaponOverrides(club, [shillelagh], ctx, { offhand: true }).damage).toBe('1d12');
  });
});

describe('handOf', () => {
  it('оружие правой и левой руки; щит — не оружие', () => {
    const loadout = loadoutOf({ attacks: [sword, knife], hands: { right: 'sw', left: HANDS_SHIELD } });
    expect(handOf(loadout, 'right')?.id).toBe('sw');
    expect(handOf(loadout, 'left')).toBeUndefined();
  });

  it('без рук — пусто', () => {
    const loadout = loadoutOf({ attacks: [sword] });
    expect(handOf(loadout, 'right')).toBeUndefined();
  });
});

describe('weaponContextOf', () => {
  it('берёт характеристики, классы и выборы из листа', () => {
    expect(weaponContextOf(null)).toEqual({ abilities: {}, classes: [] });
    const sheet = {
      abilities: { str: 16 },
      classes: [{ className: 'fighter', level: 3 }],
      choices: [{ kind: 'feat', key: 'XPHB:tavernBrawler' }],
    } as unknown as CharacterSheet;
    const ctx = weaponContextOf(sheet);
    expect(ctx.abilities.str).toBe(16);
    expect(ctx.classes[0]?.className).toBe('fighter');
    expect(ctx.choices?.[0]?.key).toBe('XPHB:tavernBrawler');
  });
});
