import { describe, expect, it } from 'vitest';
import { rollLabelText, rollMessageLabel } from './rollLabels';

describe('rollLabelText', () => {
  it('атака с дистанцией, помехой и попаданием', () => {
    expect(
      rollLabelText('attack', { subject: 'Волк — Когти', distanceFeet: 15, disadvantage: 'adjacent', hit: 'hit' })
    ).toBe('Атака: Волк — Когти · 15 фт (помеха: враг рядом) — Попал');
  });

  it('урон без результата попадания', () => {
    expect(rollLabelText('damage', { subject: 'Топор' })).toBe('Урон: Топор');
  });

  it('спасбросок и проверка', () => {
    expect(rollLabelText('save', { subject: 'Ловкость' })).toBe('Спасбросок: Ловкость');
    expect(rollLabelText('check', { subject: 'Атлетика' })).toBe('Проверка: Атлетика');
  });

  it('спасбросок от смерти', () => {
    expect(rollLabelText('death', { outcome: 'success', successes: 2, failures: 1 })).toBe(
      'Спасбросок от смерти: успех (успехи 2/3, провалы 1/3)'
    );
  });
});

describe('rollMessageLabel', () => {
  it('строит из структуры', () => {
    expect(rollMessageLabel({ rollKind: 'death', labelParams: { outcome: 'fail', successes: 0, failures: 3 } })).toBe(
      'Спасбросок от смерти: провал (успехи 0/3, провалы 3/3)'
    );
  });

  it('возвращает legacy label без структуры', () => {
    expect(rollMessageLabel({ label: 'Атака: Меч' })).toBe('Атака: Меч');
  });
});
