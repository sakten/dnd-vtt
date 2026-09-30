import { describe, expect, it } from 'vitest';
import { CUSTOM_SPELL_PREFIX, automationForSpell } from 'shared';
import spellsData from 'shared/spellsData';
import {
  WIZARD_PROFILES,
  blankRecord,
  canSwitchPrimary,
  copyRecord,
  keyFromName,
  partUsageKeys,
  switchPrimary,
  validateConstructor,
  withSave,
  withSpellAttack,
} from './spellConstructor';

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

  it('копия канона сохраняет range/duration в формате данных (Fireball/Bless)', () => {
    const fireball = spellsData.spells.find((s) => s.name === 'Fireball')!;
    const fireCopy = copyRecord(fireball, '(копия)');
    expect(fireCopy.range).toEqual({ type: 'point', distance: { type: 'feet', amount: 150 } });
    expect(fireCopy.duration).toEqual([{ type: 'instant' }]);
    expect(validateConstructor(fireCopy)).toEqual({ spec: [], local: [] });

    const bless = spellsData.spells.find((s) => s.name === 'Bless')!;
    const blessCopy = copyRecord(bless, '(копия)');
    expect(blessCopy.range).toEqual({ type: 'point', distance: { type: 'feet', amount: 30 } });
    expect(blessCopy.duration[0]).toMatchObject({
      type: 'timed',
      concentration: true,
      duration: { type: 'minute', amount: 1 },
    });
    expect(blessCopy.concentration).toBe(true);
    expect(validateConstructor(blessCopy)).toEqual({ spec: [], local: [] });
  });

  it('части урона: слоты срабатывания из автоматизации (Hunger of Hadar)', () => {
    const hoh = spellsData.spells.find((s) => s.name === 'Hunger of Hadar')!;
    const usage = partUsageKeys(hoh);
    expect(usage[0]).toContain('ui.constructor.usage.startOfTurn');
    expect(usage[1]).toContain('ui.constructor.usage.endOfTurn');
  });

  it('переключение простой ветки: attack ↔ save ↔ effect, сложные — не трогаем', () => {
    const attack = blankRecord('attack', 'Тест');
    expect(canSwitchPrimary(attack)).toBe(true);
    const save = switchPrimary(attack, 'save');
    expect(save.automation.primary).toBe('save');
    expect(save.automation.attack).toBeUndefined();
    expect(save.automation.save).toMatchObject({ ability: 'dex' });
    const effect = switchPrimary(save, 'effect');
    expect(effect.automation.effects).toHaveLength(1);
    expect(validateConstructor(effect)).toEqual({ spec: [], local: [] });

    const jallarzi = spellsData.spells.find((s) => s.key === "XPHB:Jallarzi's Storm of Radiance")!;
    expect(canSwitchPrimary(jallarzi)).toBe(false);
    expect(switchPrimary(jallarzi, 'attack')).toBe(jallarzi);
  });

  it('синхронизация спасброска и атаки с автоматизацией', () => {
    const fireball = copyRecord(spellsData.spells.find((s) => s.name === 'Fireball')!, '');
    const changed = withSave(fireball, 'con', true);
    expect(changed.save).toEqual(['con']);
    expect(changed.automation.save).toEqual({ ability: 'con', half: true });
    const cleared = withSave(changed, undefined, false);
    expect(cleared.save).toBeUndefined();
    expect(cleared.automation.save).toBeUndefined();

    const bolt = copyRecord(spellsData.spells.find((s) => s.name === 'Fire Bolt')!, '');
    const melee = withSpellAttack(bolt, 'melee');
    expect(melee.spellAttack).toBe('melee');
    expect(melee.automation.attack).toEqual({ rangeType: 'melee' });
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
