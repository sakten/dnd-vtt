import { describe, expect, it } from 'vitest';
import { MAX_ATTACKS, activeAttacks, normalizeAttacks, normalizeSheet } from './types';

describe('normalizeAttacks', () => {
  it('по умолчанию — одна пустая строка', () => {
    expect(normalizeAttacks(undefined)).toHaveLength(1);
    expect(normalizeAttacks([])).toHaveLength(1);
  });

  it('сохраняет динамическую длину и обрезает пустые строки в конце', () => {
    expect(normalizeAttacks([{ name: 'Меч' }, { name: 'Лук' }])).toHaveLength(2);
    expect(normalizeAttacks([{ name: 'Меч' }, { name: '' }])).toHaveLength(1);
    expect(normalizeAttacks([{ name: '' }, { name: 'Меч' }])).toHaveLength(2);
  });

  it('ограничивает список сверху MAX_ATTACKS', () => {
    const many = Array.from({ length: MAX_ATTACKS + 5 }, (_, i) => ({ name: `A${i}` }));
    expect(normalizeAttacks(many)).toHaveLength(MAX_ATTACKS);
  });

  it('переносит старую одиночную атаку', () => {
    const attacks = normalizeAttacks(undefined, { name: 'Лук', hit: 'd20+7', damage: 'd8+3' });
    expect(attacks).toEqual([
      { name: 'Лук', hit: 'd20+7', damage: 'd8+3', rangeType: 'melee', rangeNormal: 5, rangeLong: 0 },
    ]);
  });

  it('не перетирает существующий список legacy-атакой', () => {
    const attacks = normalizeAttacks([{ name: 'Меч', hit: 'd20+5', damage: 'd8+3' }], {
      name: 'Старое',
      hit: 'd20',
      damage: 'd6',
    });
    expect(attacks[0].name).toBe('Меч');
  });
});

describe('normalizeSheet', () => {
  it('мигрирует старую карточку с attack в attacks', () => {
    const sheet = normalizeSheet({
      name: 'Конан',
      proficiencyBonus: 'd4',
      attack: { name: 'Меч', hit: 'd20+5', damage: 'd8+3' },
    });
    expect(sheet.attacks).toHaveLength(1);
    expect(sheet.attacks[0].name).toBe('Меч');
    expect(sheet.abilities.str).toBe(10);
  });

  it('сохраняет уже новый список оружия', () => {
    const sheet = normalizeSheet({
      attacks: [
        { name: 'A', hit: 'd20', damage: 'd6', rangeType: 'melee', rangeNormal: 5, rangeLong: 0 },
        { name: 'B', hit: 'd20', damage: 'd4', rangeType: 'ranged', rangeNormal: 80, rangeLong: 320 },
        { name: 'C', hit: '', damage: '', rangeType: 'none', rangeNormal: 0, rangeLong: 0 },
      ],
    });
    expect(sheet.attacks.map((a) => a.name)).toEqual(['A', 'B', 'C']);
  });

  it('нормализует класс брони (AC)', () => {
    expect(normalizeSheet({}).ac).toBe('');
    expect(normalizeSheet({ ac: '18' }).ac).toBe('18');
    expect(normalizeSheet({ ac: 'x'.repeat(20) }).ac).toHaveLength(10);
  });
});

describe('activeAttacks', () => {
  it('отбрасывает пустые и без формул', () => {
    const sheet = normalizeSheet({
      attacks: [
        { name: 'Меч', hit: 'd20+5', damage: 'd8+3', rangeType: 'melee', rangeNormal: 5, rangeLong: 0 },
        { name: 'Только имя', hit: '', damage: '', rangeType: 'melee', rangeNormal: 5, rangeLong: 0 },
        { name: '', hit: '', damage: '', rangeType: 'melee', rangeNormal: 5, rangeLong: 0 },
      ],
    });
    expect(activeAttacks(sheet).map((a) => a.name)).toEqual(['Меч']);
  });
});
