import { describe, expect, it } from 'vitest';
import { CUSTOM_SPELL_PREFIX, automationForSpell } from 'shared';
import { WIZARD_PROFILES, blankRecord, copyRecord, keyFromName, validateConstructor } from './spellConstructor';

describe('конструктор кастомов (R16 К1)', () => {
  it('каждый профиль даёт компилируемую запись с CUSTOM-ключом', () => {
    for (const profile of WIZARD_PROFILES) {
      const record = blankRecord(profile.id, `Тест ${profile.id}`);
      expect(record.key).toBe(`${CUSTOM_SPELL_PREFIX}Тест ${profile.id}`);
      expect(validateConstructor(record)).toEqual({ spec: [], local: [] });
      expect(() => automationForSpell(record)).not.toThrow();
    }
  });

  it('копия сохраняет автоматизацию базы и меняет ключ/имя', () => {
    const base = blankRecord('save', 'Огненный шар');
    base.automation.area = { shape: 'sphere', size: 20 };
    const copy = copyRecord(base, '(копия)');
    expect(copy).not.toBe(base);
    expect(copy.key).toBe(keyFromName('Огненный шар (копия)'));
    expect(copy.automation.area).toEqual({ shape: 'sphere', size: 20 });
    expect(copy.source).toBe('CUSTOM');
  });

  it('валидация: имя, кости и пробная компиляция', () => {
    const noName = blankRecord('attack', ' ');
    expect(validateConstructor(noName).local.some((i) => i.code === 'nameRequired')).toBe(true);

    const badDice = blankRecord('attack', 'Тест');
    badDice.damage = { dice: ['abc'], types: ['fire'] };
    expect(validateConstructor(badDice).local.some((i) => i.code === 'diceInvalid')).toBe(true);

    // Убрали кости данных, а автоматизация ссылается `spellDamage` — компиляция падает.
    const noDice = blankRecord('attack', 'Тест');
    noDice.damage = undefined;
    expect(validateConstructor(noDice).local.some((i) => i.code === 'compileFailed')).toBe(true);
  });

  it('валидация: семантика спека — коды i18n', () => {
    const record = blankRecord('buff', 'Тест');
    // Эффект без эффектов и зоны — ошибка ветки effect.
    record.automation.effects = [];
    expect(validateConstructor(record).spec).toContainEqual({ code: 'effectWithoutEffects' });
  });
});
