import { describe, expect, it } from 'vitest';
import {
  collectText,
  firstSentence,
  normalizeComponents,
  normalizeDuration,
  normalizeRange,
  normalizeSpell,
  normalizeTime,
  spellKey,
  stripTags,
  type RawSpell,
} from './spells';

describe('stripTags', () => {
  it('снимает бросок/сложность/попадание', () => {
    expect(stripTags('{@damage 8d6} Fire damage')).toBe('8d6 Fire damage');
    expect(stripTags('make a {@dc 15} Dexterity save')).toBe('make a DC 15 Dexterity save');
    expect(stripTags('{@hit 5} to hit')).toBe('+5 to hit');
    expect(stripTags('{@hit -2} to hit')).toBe('-2 to hit');
  });

  it('капитализирует имена и условия', () => {
    expect(stripTags('{@spell fireball|XPHB}')).toBe('Fireball');
    expect(stripTags('the {@condition prone} target')).toBe('the Prone target');
    expect(stripTags('{@atk mw}')).toBe('Melee Weapon Attack');
  });

  it('курсив/жирный не капитализирует', () => {
    expect(stripTags('{@i very} important')).toBe('very important');
    expect(stripTags('{@b bold}')).toBe('bold');
  });

  it('схлопывает пробелы и тримит', () => {
    expect(stripTags('  a\n\n  b  ')).toBe('a b');
  });
});

describe('firstSentence', () => {
  it('берёт первое предложение', () => {
    expect(firstSentence('First one. Second two.')).toBe('First one.');
  });
  it('без точки — всё предложение', () => {
    expect(firstSentence('just text')).toBe('just text');
  });
  it('обрезает длинные', () => {
    const long = `${'a'.repeat(300)}.`;
    expect(firstSentence(long).endsWith('…')).toBe(true);
    expect(firstSentence(long).length).toBeLessThanOrEqual(280);
  });
});

describe('collectText', () => {
  it('разворачивает вложенные entries и списки', () => {
    const entries = ['para one', { type: 'list', items: ['item a', 'item b'] }, { type: 'entries', entries: ['nested'] }];
    expect(collectText(entries)).toEqual(['para one', 'item a', 'item b', 'nested']);
  });
});

describe('нормализаторы полей', () => {
  it('время: действие/реакция с условием', () => {
    expect(normalizeTime([{ number: 1, unit: 'action' }])).toEqual([{ number: 1, unit: 'action' }]);
    expect(normalizeTime(undefined)).toEqual([{ number: 1, unit: 'action' }]);
    const reaction = normalizeTime([{ number: 1, unit: 'reaction', condition: 'when hit' }]);
    expect(reaction[0].condition).toBe('when hit');
  });

  it('дистанция: точка/касание/я', () => {
    expect(normalizeRange({ type: 'point', distance: { type: 'feet', amount: 150 } })).toEqual({
      type: 'point',
      distance: { type: 'feet', amount: 150 },
    });
    expect(normalizeRange({ type: 'self' })).toEqual({ type: 'self', distance: undefined });
  });

  it('длительность: концентрация', () => {
    const d = normalizeDuration([{ type: 'timed', duration: { type: 'minute', amount: 1 }, concentration: true }]);
    expect(d[0].concentration).toBe(true);
    expect(d[0].duration).toEqual({ type: 'minute', amount: 1 });
    expect(normalizeDuration(undefined)).toEqual([{ type: 'instant' }]);
  });

  it('компоненты', () => {
    expect(normalizeComponents({ v: true, s: true, m: 'guano' })).toEqual({ v: true, s: true, m: 'guano' });
    expect(normalizeComponents({ v: true })).toEqual({ v: true, s: undefined, m: undefined });
  });
});

describe('normalizeSpell', () => {
  const fireball: RawSpell = {
    name: 'Fireball',
    source: 'XPHB',
    level: 3,
    school: 'V',
    srd52: true,
    time: [{ number: 1, unit: 'action' }],
    range: { type: 'point', distance: { type: 'feet', amount: 150 } },
    components: { v: true, s: true, m: 'a ball of bat guano and sulfur' },
    duration: [{ type: 'instant' }],
    entries: ['A bright streak flashes. Each creature takes {@damage 8d6} Fire damage.'],
    entriesHigherLevel: [{ type: 'entries', entries: ['Scaling {@scaledamage 8d6|3-9|1d6} per level.'] }],
    damageInflict: ['fire'],
    savingThrow: ['dexterity'],
  };

  it('SRD: полный текст, higher level, урон/спас', () => {
    const spell = normalizeSpell(fireball, ['sorcerer', 'wizard']);
    expect(spell.key).toBe('XPHB:Fireball');
    expect(spell.school).toBe('Evocation');
    expect(spell.classes).toEqual(['sorcerer', 'wizard']);
    expect(spell.damage?.dice).toEqual(['8d6']);
    expect(spell.damage?.types).toEqual(['fire']);
    expect(spell.save).toEqual(['dex']);
    expect(spell.automation).toBe('full');
    expect(spell.description).toHaveLength(1);
    expect(spell.description[0]).toContain('8d6 Fire damage');
    // `{@scaledamage base|levels|increment}` → в тексте инкремент (1d6), не база.
    expect(spell.higherLevel?.[0]).toContain('1d6');
    expect(spell.higherLevel?.[0]).not.toContain('8d6');
  });

  it('не-SRD: только первое предложение', () => {
    const spell = normalizeSpell(
      {
        name: 'X',
        source: 'XGE',
        level: 2,
        school: 'E',
        entries: ['First sentence. Second sentence.'],
        savingThrow: ['wisdom'],
      },
      ['bard']
    );
    expect(spell.description).toEqual(['First sentence.']);
    expect(spell.higherLevel).toBeUndefined();
    expect(spell.save).toEqual(['wis']);
    expect(spell.automation).toBe('manual');
  });

  it('ритуал и заклинательная атака', () => {
    const spell = normalizeSpell(
      {
        name: 'Ritual Attack',
        source: 'XPHB',
        level: 1,
        school: 'V',
        meta: { ritual: true },
        time: [{ number: 1, unit: 'action' }],
        duration: [{ type: 'instant' }],
        entries: ['Deal {@damage 1d8} Force damage.'],
        damageInflict: ['force'],
        spellAttack: ['R'],
      },
      ['wizard']
    );
    expect(spell.ritual).toBe(true);
    expect(spell.spellAttack).toBe('ranged');
    expect(spell.automation).toBe('full');
  });

  it('spellKey', () => {
    expect(spellKey('Mage Hand', 'XPHB')).toBe('XPHB:Mage Hand');
  });

  it('состояния из conditionInflict', () => {
    const spell = normalizeSpell(
      { name: 'T', source: 'XPHB', level: 1, school: 'E', entries: ['Text.'], conditionInflict: ['prone', 'frightened'] },
      ['wizard']
    );
    expect(spell.conditions).toEqual(['Prone', 'Frightened']);
  });
});
