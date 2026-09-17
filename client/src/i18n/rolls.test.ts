import { describe, expect, it } from 'vitest';
import { rollLabelText as sharedLabel } from 'shared';
import { rollMessageLabel, rollLabelText } from './rolls';
import { setLocale } from './index';

const cases = [
  ['attack', { subject: 'Волк — Когти', distanceFeet: 15, disadvantage: 'adjacent', hit: 'hit' }],
  ['attack', { subject: 'Меч', penalty: -2, hit: 'miss' }],
  ['damage', { subject: 'Топор', damageType: 'slashing', damageNote: 'resistance' }],
  ['heal', { subject: 'Хит дайс d8' }],
  ['save', { subject: 'Ловкость', saveOutcome: 'fail' }],
  ['check', { subject: 'Атлетика', dc: 15, checkOutcome: 'success' }],
  ['death', { outcome: 'critSuccess', successes: 2, failures: 1 }],
  ['plain', { subject: 'Хит дайс d8 (лечение 5)' }],
  ['attack', {}],
] as const;

describe('rollLabelText (i18n)', () => {
  it('RU совпадает с shared-версией', () => {
    setLocale('ru');
    for (const [kind, params] of cases) {
      expect(rollLabelText(kind, params)).toBe(sharedLabel(kind, params));
    }
    setLocale('ru');
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
