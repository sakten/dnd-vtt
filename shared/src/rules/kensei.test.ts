import { describe, expect, it } from 'vitest';
import type { ClassLevel, SheetHands } from '../domain/sheet';
import type { AttackEntry } from '../domain/token';
import { isKenseiAttack, isKenseiWeaponKey, kenseiMonkLevel, kenseiWeaponKeyOf } from './kensei';
import { loadoutOf } from './loadout';

const longsword = (patch: Partial<AttackEntry> = {}): AttackEntry => ({
  id: 'a1',
  name: 'Longsword',
  hit: 'd20+str',
  damage: '1d8+str',
  damageType: 'slashing',
  rangeType: 'melee',
  rangeNormal: 5,
  rangeLong: 0,
  weaponKey: 'XPHB:Longsword',
  ...patch,
});

const kensei = (level = 3): ClassLevel[] => [{ className: 'monk', level, subclass: 'kensei' }];

const hands = (right?: string, left?: string): SheetHands => ({
  ...(right ? { right } : {}),
  ...(left ? { left } : {}),
});

describe('kensei: кэнсэй-оружие', () => {
  it('допустимость по RAW: simple/martial без heavy/special, longbow разрешён', () => {
    expect(isKenseiWeaponKey('XPHB:Longsword')).toBe(true);
    expect(isKenseiWeaponKey('XPHB:Club')).toBe(true);
    expect(isKenseiWeaponKey('XPHB:Longbow')).toBe(true);
    expect(isKenseiWeaponKey('XPHB:Greatsword')).toBe(false);
    expect(isKenseiWeaponKey('XPHB:Unarmed Strike')).toBe(false);
    expect(isKenseiWeaponKey(undefined)).toBe(false);
  });

  it('оружие основной руки: уровень и подкласс проверяются', () => {
    const attacks = [longsword()];
    expect(kenseiWeaponKeyOf({ attacks, hands: hands('a1'), classes: kensei() })).toBe('XPHB:Longsword');
    expect(kenseiWeaponKeyOf({ attacks, hands: hands('a1'), classes: kensei(2) })).toBeUndefined();
    expect(kenseiWeaponKeyOf({ attacks, hands: hands('a1'), classes: [{ className: 'monk', level: 3, subclass: 'openHand' }] })).toBeUndefined();
    expect(kenseiWeaponKeyOf({ attacks, hands: hands(undefined, 'a1'), classes: kensei() })).toBeUndefined();
    expect(kenseiWeaponKeyOf({ attacks: [longsword({ weaponKey: 'XPHB:Greatsword' })], hands: hands('a1'), classes: kensei() })).toBeUndefined();
  });

  it('кэнсэй-уровень: 0 без подкласса, иначе уровень монаха', () => {
    expect(kenseiMonkLevel(undefined)).toBe(0);
    expect(kenseiMonkLevel([{ className: 'monk', level: 7, subclass: 'kensei' }])).toBe(7);
    expect(kenseiMonkLevel([{ className: 'monk', level: 7 }])).toBe(0);
  });
});

describe('kensei: monk weapon основной руки', () => {
  const abilities = { str: 10, dex: 16 };

  it('Dex и кость боевых искусств вместо Силы и кости оружия', () => {
    const loadout = loadoutOf({
      attacks: [longsword()],
      hands: hands('a1'),
      abilities,
      classes: kensei(3),
    });
    const entry = loadout.attacks.find((a) => a.id === 'a1')!;
    expect(entry.hit).toBe('d20+5');
    expect(entry.damage).toBe('1d6+3');
    expect(entry.weaponKey).toBe('XPHB:Longsword');
  });

  it('кость растёт по уровню монаха (11 ур. — d10)', () => {
    const loadout = loadoutOf({ attacks: [longsword()], hands: hands('a1'), abilities, classes: kensei(11) });
    expect(loadout.attacks[0]!.damage).toBe('1d10+3');
  });

  it('без кэнсэй-уровня, в левой руке или с недопустимым оружием — без подмены', () => {
    const base = [longsword()];
    expect(loadoutOf({ attacks: base, hands: hands('a1'), abilities, classes: kensei(2) }).attacks[0]!.damage).toBe('1d8+str');
    expect(loadoutOf({ attacks: base, hands: hands(undefined, 'a1'), abilities, classes: kensei(3) }).attacks[0]!.damage).toBe('1d8+str');
    expect(loadoutOf({ attacks: base, hands: hands('a1'), abilities, classes: [{ className: 'monk', level: 3, subclass: 'openHand' }] }).attacks[0]!.damage).toBe('1d8+str');
    expect(loadoutOf({ attacks: [longsword({ weaponKey: 'XPHB:Greatsword' })], hands: hands('a1'), abilities, classes: kensei(3) }).attacks[0]!.damage).toBe('1d8+str');
  });

  it('isKenseiAttack: атака именно кэнсэй-оружием основной руки', () => {
    const actor = { attacks: [longsword()], hands: hands('a1'), classes: kensei(3) };
    expect(isKenseiAttack(actor, longsword())).toBe(true);
    expect(isKenseiAttack(actor, longsword({ weaponKey: 'XPHB:Longbow' }))).toBe(false);
    expect(isKenseiAttack(actor, undefined)).toBe(false);
  });
});
