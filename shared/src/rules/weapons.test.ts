import { describe, expect, it } from 'vitest';
import { WEAPONS, findUnarmedAttack, isUnarmedAttack, weaponAttackEntry } from './weapons';

const abilities = { str: 16, dex: 14, con: 12, int: 10, wis: 12, cha: 8 };

describe('weaponAttackEntry', () => {
  it('силовое оружие: PB+Сила, кость+Сила', () => {
    const longsword = WEAPONS.find((w) => w.name === 'Longsword')!;
    const entry = weaponAttackEntry(longsword, { abilities, classes: [{ className: 'fighter', level: 5 }] });
    expect(entry.hit).toBe('d20+6'); // PB 3 + Сила 3
    expect(entry.damage).toBe('1d8+3');
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

  it('findUnarmedAttack ищет по kind и имени', () => {
    expect(isUnarmedAttack({ name: 'Безоружный удар' } as never)).toBe(true);
    const found = findUnarmedAttack([{ name: 'Меч' } as never, { name: 'x', kind: 'unarmed' } as never]);
    expect(found?.kind).toBe('unarmed');
  });
});
