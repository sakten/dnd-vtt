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
import { HANDS_SHIELD, gripAdjustedDamage, normalizeHands, primaryHandAttack, rightGrip } from './hands';

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

describe('руки персонажа (hands)', () => {
  const ctx = { abilities, classes: [{ className: 'fighter', level: 5 }] };
  const longsword = WEAPONS.find((w) => w.name === 'Longsword')!;
  const greataxe = WEAPONS.find((w) => w.name === 'Greataxe')!;
  const dagger = WEAPONS.find((w) => w.name === 'Dagger')!;
  const sword = { ...weaponAttackEntry(longsword, ctx), id: 'sword' };
  const axe = { ...weaponAttackEntry(greataxe, ctx), id: 'axe' };
  const knife = { ...weaponAttackEntry(dagger, ctx), id: 'knife' };
  const attacks = [sword, axe, knife];

  it('хват универсального: 1h/2h и offhand — одноручная кость', () => {
    expect(weaponAttackEntry(longsword, ctx, { grip: '1h' }).damage).toBe('1d8+3');
    expect(weaponAttackEntry(longsword, ctx, { grip: '2h' }).damage).toBe('1d10+3');
    expect(weaponAttackEntry(longsword, ctx, { offhand: true }).damage).toBe('1d8');
    expect(weaponAttackEntry(longsword, ctx).damage).toBe('1d10+3');
  });

  it('rightGrip: левая свободна — 2h, занята — 1h', () => {
    expect(rightGrip(attacks, undefined)).toBe('1h');
    expect(rightGrip(attacks, { right: 'sword' })).toBe('2h');
    expect(rightGrip(attacks, { right: 'sword', left: 'knife' })).toBe('1h');
    expect(rightGrip(attacks, { right: 'sword', left: HANDS_SHIELD })).toBe('1h');
    expect(rightGrip(attacks, { right: 'axe' })).toBe('2h');
  });

  it('gripAdjustedDamage меняет только кость, модификаторы сохраняются', () => {
    expect(gripAdjustedDamage('1d10+3', longsword, '1h')).toBe('1d8+3');
    expect(gripAdjustedDamage('1d8+1+str', longsword, '2h')).toBe('1d10+1+str');
    expect(gripAdjustedDamage('1d10+3', longsword, '2h')).toBe('1d10+3');
    expect(gripAdjustedDamage('2d6+3', greataxe, '1h')).toBe('2d6+3');
  });

  it('normalizeHands: невалидные id и дубли сбрасываются', () => {
    expect(normalizeHands({ right: 'sword', left: 'sword' }, attacks)).toEqual({ right: 'sword' });
    expect(normalizeHands({ right: 'nope', left: 'knife' }, attacks)).toEqual({ left: 'knife' });
    expect(normalizeHands({ right: HANDS_SHIELD, left: HANDS_SHIELD }, attacks)).toEqual({ right: HANDS_SHIELD });
    expect(normalizeHands({}, attacks)).toBeUndefined();
  });

  it('normalizeHands: двуручное только в правой', () => {
    expect(normalizeHands({ left: 'axe' }, attacks)).toEqual({ right: 'axe' });
    expect(normalizeHands({ right: 'axe', left: 'knife' }, attacks)).toEqual({ right: 'axe' });
    expect(normalizeHands({ left: 'axe', right: 'sword' }, attacks)).toEqual({ right: 'sword' });
  });

  it('primaryHandAttack: оружие правой или безоружный — по большей кости', () => {
    expect(primaryHandAttack(attacks, { right: 'sword' }, ctx)).toMatchObject({ kind: 'weapon' });
    expect(primaryHandAttack(attacks, undefined, ctx).kind).toBe('unarmed');
    // Монах с кинжалом: безоружный 1d8 против 1d4 — основная безоружная.
    const monkCtx = { abilities, classes: [{ className: 'monk', level: 5 }] };
    expect(primaryHandAttack(attacks, { right: 'knife' }, monkCtx).kind).toBe('unarmed');
    expect(primaryHandAttack(attacks, { right: 'sword' }, monkCtx).kind).toBe('weapon');
  });
});

