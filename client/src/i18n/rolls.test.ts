import { describe, expect, it } from 'vitest';
import { rollMessageLabel, rollLabelText } from './rolls';
import { setLocale } from './index';

const cases = [
  ['attack', { subject: 'Волк — Когти', distanceFeet: 15, disadvantage: 'adjacent', hit: 'hit' }, 'Атака: Волк — Когти · 15 фт (помеха: враг рядом) — Попал'],
  ['attack', { subject: 'Меч', penalty: -2, hit: 'miss' }, 'Атака: Меч (истощение -2) — Промах'],
  ['damage', { subject: 'Топор', damageType: 'slashing', damageNote: 'resistance' }, 'Урон: Топор (Режущий) — сопротивление'],
  ['heal', { subject: 'Хит дайс d8' }, 'Лечение: Хит дайс d8'],
  ['save', { subject: 'Ловкость', saveOutcome: 'fail' }, 'Спасбросок: Ловкость — Провал'],
  ['check', { subject: 'Атлетика', dc: 15, checkOutcome: 'success' }, 'Проверка: Атлетика · Сл 15 — Успех'],
  ['death', { outcome: 'critSuccess', successes: 2, failures: 1 }, 'Спасбросок от смерти: критический успех (успехи 2/3, провалы 1/3)'],
  ['plain', { subject: 'Хит дайс d8 (лечение 5)' }, 'Хит дайс d8 (лечение 5)'],
  ['attack', {}, 'Атака: Атака'],
] as const;

describe('rollLabelText (i18n)', () => {
  it('RU собирает метку из структуры броска', () => {
    setLocale('ru');
    for (const [kind, params, expected] of cases) {
      expect(rollLabelText(kind, params)).toBe(expected);
    }
  });

  it('EN переводит заголовок и исход', () => {
    setLocale('en');
    expect(rollLabelText('check', { subject: 'Athletics', dc: 15, checkOutcome: 'success' })).toBe(
      'Check: Athletics · DC 15 — Success'
    );
    setLocale('ru');
  });

  it('rollMessageLabel: структура важнее сохранённого label, без структуры — label', () => {
    setLocale('ru');
    expect(rollMessageLabel({ rollKind: 'damage', labelParams: { subject: 'Топор' }, label: 'Старое' })).toBe('Урон: Топор');
    expect(rollMessageLabel({ label: 'Атака: Меч' })).toBe('Атака: Меч');
  });
});
