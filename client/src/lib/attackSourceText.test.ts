import { describe, expect, it } from 'vitest';
import { attackSourceLabel } from './attackSourceText';

describe('attackSourceLabel', () => {
  it('состояние и дистанция переводятся через i18n', () => {
    expect(attackSourceLabel({ side: 'disadvantage', kind: 'condition', key: 'prone' })).toBe('Сбит с ног');
    expect(attackSourceLabel({ side: 'disadvantage', kind: 'range', key: 'long' })).toBe('дальняя дистанция');
    expect(attackSourceLabel({ side: 'disadvantage', kind: 'range', key: 'adjacent' })).toBe('враг рядом');
  });

  it('эффект показывается по имени, невидимость/тяжёлое — по ключам', () => {
    expect(attackSourceLabel({ side: 'advantage', kind: 'effect', name: 'Ярость' })).toBe('Ярость');
    expect(attackSourceLabel({ side: 'disadvantage', kind: 'unseen', key: 'target' })).toBe('Не видит цель');
    expect(attackSourceLabel({ side: 'disadvantage', kind: 'weapon', key: 'heavy' })).toBe('Тяжёлое оружие');
  });
});
