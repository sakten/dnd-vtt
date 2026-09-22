import { describe, expect, it } from 'vitest';
import {
  WEAPONS,
  findUnarmedAttack,
  isUnarmedAttack,
  masteryAccessible,
  unarmedStrikeEntry,
  weaponAbilityMod,
  weaponAttackEntries,
  weaponAttackEntry,
  weaponHasProperty,
  weaponMastery,
} from './weapons';

const abilities = { str: 16, dex: 14, con: 12, int: 10, wis: 12, cha: 8 };

describe('weaponAttackEntry', () => {
  it('силовое оружие: PB+Сила, кость+Сила (универсальное — всегда двуручная кость)', () => {
    const longsword = WEAPONS.find((w) => w.name === 'Longsword')!;
    const entry = weaponAttackEntry(longsword, { abilities, classes: [{ className: 'fighter', level: 5 }] });
    expect(entry.hit).toBe('d20+6'); // PB 3 + Сила 3
    expect(entry.damage).toBe('1d10+3');
    expect(entry.rangeType).toBe('melee');
  });

  it('фехтовальное — лучшая из Силы/Ловкости', () => {
    const rapier = WEAPONS.find((w) => w.name === 'Rapier') ?? WEAPONS.find((w) => w.properties.includes('F'))!;
    const entry = weaponAttackEntry(rapier, { abilities, classes: [{ className: 'rogue', level: 1 }] });
    expect(entry.damage.endsWith('+3')).toBe(true);
  });

  it('дальнее — Ловкость', () => {
    const bow = WEAPONS.find((w) => w.rangeType === 'ranged')!;
    const entry = weaponAttackEntry(bow, { abilities, classes: [{ className: 'fighter', level: 1 }] });
    expect(entry.damage.endsWith('+2')).toBe(true);
    expect(entry.rangeNormal).toBeGreaterThan(0);
  });

  it('безоружный удар монаха — кость боевых искусств и Ловкость', () => {
    const unarmed = WEAPONS.find((w) => w.unarmed)!;
    const entry = weaponAttackEntry(unarmed, { abilities, classes: [{ className: 'monk', level: 5 }] });
    expect(entry.kind).toBe('unarmed');
    expect(entry.damage).toBe('1d8+2');
  });

  it('безоружный удар не-монаха — 1+Сила', () => {
    const unarmed = WEAPONS.find((w) => w.unarmed)!;
    const entry = weaponAttackEntry(unarmed, { abilities, classes: [{ className: 'fighter', level: 1 }] });
    expect(entry.damage).toBe('1+3');
  });

  it('пишет ключ оружия из справочника (для свойств и мастерства)', () => {
    const longsword = WEAPONS.find((w) => w.name === 'Longsword')!;
    const entry = weaponAttackEntry(longsword, { abilities, classes: [{ className: 'fighter', level: 5 }] });
    expect(entry.weaponKey).toBe(longsword.key);
    const unarmed = WEAPONS.find((w) => w.unarmed)!;
    expect(weaponAttackEntry(unarmed, { abilities, classes: [] }).weaponKey).toBe(unarmed.key);
  });

  it('weaponHasProperty читает свойства по ключу атаки', () => {
    const crossbow = WEAPONS.find((w) => w.name === 'Light Crossbow')!;
    const entry = weaponAttackEntry(crossbow, { abilities, classes: [{ className: 'fighter', level: 1 }] });
    expect(weaponHasProperty(entry, 'LD')).toBe(true);
    expect(weaponHasProperty(entry, 'H')).toBe(false);
    expect(weaponHasProperty({ ...entry, weaponKey: undefined }, 'LD')).toBe(false);
  });

  it('метательное ближнего боя даёт две атаки: 5/0 и бросок 30/120', () => {
    const ctx = { abilities, classes: [{ className: 'fighter', level: 1 }] };
    const javelin = WEAPONS.find((w) => w.name === 'Javelin')!;
    const [melee, thrown] = weaponAttackEntries(javelin, ctx);
    expect(melee?.rangeType).toBe('melee');
    expect(melee?.rangeNormal).toBe(5);
    expect(thrown?.rangeType).toBe('ranged');
    expect(thrown?.rangeNormal).toBe(30);
    expect(thrown?.rangeLong).toBe(120);
    expect(thrown?.damage).toBe(melee?.damage);
    // Неметательное — одна атака.
    expect(weaponAttackEntries(WEAPONS.find((w) => w.name === 'Longsword')!, ctx)).toHaveLength(1);
    // Метательное с фехтованием (кинжал) — тоже две, мод лучший из Силы/Ловкости.
    const dagger = WEAPONS.find((w) => w.name === 'Dagger')!;
    const [daggerMelee, daggerThrown] = weaponAttackEntries(dagger, ctx);
    expect(daggerThrown?.rangeType).toBe('ranged');
    expect(daggerThrown?.hit).toBe(daggerMelee?.hit);
  });

  it('offhand: урон без модификатора, отрицательный сохраняется', () => {
    const dagger = WEAPONS.find((w) => w.name === 'Dagger')!;
    const strong = { abilities: { str: 16, dex: 14 }, classes: [] };
    const normal = weaponAttackEntry(dagger, strong);
    const offhand = weaponAttackEntry(dagger, strong, { offhand: true });
    expect(normal.damage).toBe('1d4+3');
    expect(offhand.damage).toBe('1d4');
    expect(offhand.hit).toBe(normal.hit);
    const weak = weaponAttackEntry(dagger, { abilities: { str: 6, dex: 6 }, classes: [] }, { offhand: true });
    expect(weak.damage).toBe('1d4-2');
  });

  it('masteryAccessible: доступ к мастерствам по классу (2024), автоматически', () => {
    expect(masteryAccessible([{ className: 'wizard', level: 5 }])).toBe(false);
    expect(masteryAccessible([{ className: 'rogue', level: 1 }])).toBe(true);
    expect(masteryAccessible([{ className: 'fighter', level: 3 }, { className: 'wizard', level: 2 }])).toBe(true);
    expect(masteryAccessible([])).toBe(false);
  });

  it('weaponMastery: мастерство оружия при доступе по классу', () => {
    const fighter = [{ className: 'fighter', level: 1 }];
    const greatsword = WEAPONS.find((w) => w.name === 'Greatsword')!;
    const entry = weaponAttackEntry(greatsword, { abilities, classes: fighter });
    expect(weaponMastery(entry, fighter)).toBe('Graze');
    expect(weaponMastery(entry, [{ className: 'wizard', level: 5 }])).toBeUndefined();
    expect(weaponMastery({ ...entry, weaponKey: undefined }, fighter)).toBeUndefined();
  });

  it('weaponAbilityMod: характеристика атаки (Graze, вторая рука)', () => {
    const rapier = WEAPONS.find((w) => w.name === 'Rapier')!;
    expect(weaponAbilityMod(rapier, { abilities: { str: 16, dex: 14 }, classes: [] })).toBe(3);
    expect(weaponAbilityMod(rapier, { abilities: { str: 6, dex: 6 }, classes: [] })).toBe(-2);
  });

  it('findUnarmedAttack ищет по kind и имени', () => {
    expect(isUnarmedAttack({ name: 'Безоружный удар' } as never)).toBe(true);
    const found = findUnarmedAttack([{ name: 'Меч' } as never, { name: 'x', kind: 'unarmed' } as never]);
    expect(found?.kind).toBe('unarmed');
  });

  it('Tavern Brawler: безоружный удар бьёт 1d4 + Сила, у монаха — кость боевых искусств', () => {
    const choices = [{ kind: 'feat', key: 'XPHB:tavernBrawler' }] as Parameters<typeof unarmedStrikeEntry>[1]['choices'];
    const fighter = unarmedStrikeEntry(undefined, { abilities, classes: [{ className: 'fighter', level: 1 }], choices });
    expect(fighter.damage).toBe('1d4+3');
    expect(fighter.kind).toBe('unarmed');
    const monk = unarmedStrikeEntry(undefined, { abilities, classes: [{ className: 'monk', level: 5 }], choices });
    expect(monk.damage).toBe('1d8+2');
    const plain = unarmedStrikeEntry(undefined, { abilities, classes: [{ className: 'fighter', level: 1 }] });
    expect(plain.damage).toBe('1+3');
  });
});
