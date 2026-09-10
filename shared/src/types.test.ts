import { describe, expect, it } from 'vitest';
import { MAX_ATTACKS, activeAttacks, normalizeAttacks, normalizeSheet } from './types';

describe('normalizeAttacks', () => {
  it('всегда даёт три поля оружия', () => {
    expect(normalizeAttacks(undefined)).toHaveLength(MAX_ATTACKS);
    expect(normalizeAttacks([{ name: 'Меч' }])).toHaveLength(MAX_ATTACKS);
  });

  it('переносит старую одиночную атаку в первое поле', () => {
    const attacks = normalizeAttacks(undefined, { name: 'Лук', hit: 'd20+7', damage: 'd8+3' });
    expect(attacks[0]).toEqual({ name: 'Лук', hit: 'd20+7', damage: 'd8+3' });
    expect(attacks[1]).toEqual({ name: '', hit: '', damage: '' });
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
    expect(sheet.attacks).toHaveLength(MAX_ATTACKS);
    expect(sheet.attacks[0].name).toBe('Меч');
    expect(sheet.abilities.str).toBe(10);
  });

  it('сохраняет уже новый список оружия', () => {
    const sheet = normalizeSheet({
      attacks: [
        { name: 'A', hit: 'd20', damage: 'd6' },
        { name: 'B', hit: 'd20', damage: 'd4' },
        { name: 'C', hit: '', damage: '' },
      ],
    });
    expect(sheet.attacks.map((a) => a.name)).toEqual(['A', 'B', 'C']);
  });
});

describe('activeAttacks', () => {
  it('отбрасывает пустые и без формул', () => {
    const sheet = normalizeSheet({
      attacks: [
        { name: 'Меч', hit: 'd20+5', damage: 'd8+3' },
        { name: 'Только имя', hit: '', damage: '' },
        { name: '', hit: '', damage: '' },
      ],
    });
    expect(activeAttacks(sheet).map((a) => a.name)).toEqual(['Меч']);
  });
});
