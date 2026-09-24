import { describe, expect, it } from 'vitest';
import {
  collectText,
  deriveAreaSpec,
  deriveAttackCount,
  deriveCantripTiers,
  deriveUpcast,
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

describe('deriveUpcast (числа апкаста из текста, без хранения правил)', () => {
  it('линейный XPHB-вид: кости за каждый круг выше', () => {
    expect(
      deriveUpcast(['The damage increases by {@scaledamage 2d6|1-9|1d6} for each spell slot level above 1.'])
    ).toEqual({ above: 1, dice: '1d6' });
  });

  it('XGE-вид и «за каждые два круга»', () => {
    expect(
      deriveUpcast([
        'When you cast this spell using a spell slot of 4th level or higher, the damage increases by 1d8 for every two slot levels above 3rd.',
      ])
    ).toEqual({ above: 3, every: 2, dice: '1d8' });
    expect(
      deriveUpcast([
        'When you cast this spell using a spell slot of 2nd level or higher, the extra damage increases by 1d6 for each slot level above 1st.',
      ])
    ).toEqual({ above: 1, dice: '1d6' });
  });

  it('дополнительные цели', () => {
    expect(
      deriveUpcast(['You can target one additional creature for each spell slot level above 1.'])
    ).toEqual({ above: 1, targets: 1 });
    expect(
      deriveUpcast(['When you cast this spell using a spell slot of 4th level or higher, you can target one additional willing creature for each slot level above 3rd.'])
    ).toEqual({ above: 3, targets: 1 });
  });

  it('ступени: Elemental Weapon и Shadow Blade', () => {    expect(
      deriveUpcast([
        'If you use a level 5-6 spell slot, the bonus to attack rolls increases to +2, and the extra damage increases to 2d4. If you use a level 7+ spell slot, the bonus increases to +3, and the extra damage increases to 3d4.',
      ])
    ).toEqual({
      tiers: [
        { level: 5, attack: 2, dice: '2d4' },
        { level: 7, attack: 3, dice: '3d4' },
      ],
    });
    expect(
      deriveUpcast([
        'When you cast this spell using a 3rd- or 4th-level spell slot, the damage increases to 3d8. When you cast it using a 5th- or 6th-level spell slot, the damage increases to 4d8. When you cast it using a spell slot of 7th level or higher, the damage increases to 5d8.',
      ])
    ).toEqual({
      tiers: [
        { level: 3, dice: '3d8' },
        { level: 5, dice: '4d8' },
        { level: 7, dice: '5d8' },
      ],
    });
  });
});

describe('deriveCantripTiers (скейл кантрипов по уровням персонажа)', () => {
  it('XPHB: уровни 5/11/17 из entriesHigherLevel', () => {
    expect(
      deriveCantripTiers(
        ['The damage increases by {@damage 1d6} when you reach levels 5 ({@damage 2d6}), 11 ({@damage 3d6}), and 17 ({@damage 4d6}).'],
        []
      )
    ).toEqual([
      { level: 5, dice: '2d6' },
      { level: 11, dice: '3d6' },
      { level: 17, dice: '4d6' },
    ]);
  });

  it('TCE-кантрип: кость райдера из описания (Booming Blade)', () => {
    expect(
      deriveCantripTiers(
        [],
        [
          "At 5th level, the melee attack deals an extra {@damage 1d8} thunder damage to the target on a hit, and the damage the target takes for moving increases to {@damage 2d8}. Both damage rolls increase by 1d8 at 11th level ({@damage 2d8} and {@damage 3d8}) and 17th level ({@damage 3d8} and {@damage 4d8}).",
        ]
      )
    ).toEqual([
      { level: 5, dice: '1d8' },
      { level: 11, dice: '2d8' },
      { level: 17, dice: '3d8' },
    ]);
  });

  it('нет скейла — undefined', () => {
    expect(deriveCantripTiers([], ['You hurl a beam of crackling energy.'])).toBeUndefined();
  });

  it('лучи от уровня персонажа (Eldritch Blast)', () => {
    expect(
      deriveCantripTiers(
        ['The spell creates two beams at level 5, three beams at level 11, and four beams at level 17.'],
        []
      )
    ).toEqual([
      { level: 5, count: 2 },
      { level: 11, count: 3 },
      { level: 17, count: 4 },
    ]);
  });
});

describe('deriveUpcast: плоские прибавки и снаряды', () => {
  it('Armor of Agathys: +5 врем. HP и урона за круг', () => {
    expect(
      deriveUpcast(['The Temporary Hit Points and the Cold damage both increase by 5 for each spell slot level above 1.'])
    ).toEqual({ above: 1, flat: 5 });
  });

  it('Magic Missile / Scorching Ray: +1 снаряд за круг', () => {
    expect(deriveUpcast(['The spell creates one more dart for each spell slot level above 1.'])).toEqual({
      above: 1,
      attacks: 1,
    });
    expect(deriveUpcast(['You create one additional ray for each spell slot level above 2.'])).toEqual({
      above: 2,
      attacks: 1,
    });
  });

  it('deriveAttackCount: базовое число снарядов из описания', () => {
    expect(deriveAttackCount(['You create three glowing darts of magical force.'])).toBe(3);
    expect(deriveAttackCount(['You hurl three fiery rays.'])).toBe(3);
    expect(deriveAttackCount(['You hurl a beam of crackling energy.'])).toBeUndefined();
  });
});

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
    expect(reaction[0]!.condition).toBe('when hit');
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
    expect(d[0]!.concentration).toBe(true);
    expect(d[0]!.duration).toEqual({ type: 'minute', amount: 1 });
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
    expect(spell.conditions).toEqual(['prone', 'frightened']);
  });

  it('бросок по таблице ({@dice}) не считается уроном (Mirror Image)', () => {
    const spell = normalizeSpell(
      {
        name: 'Mirror Image',
        source: 'XPHB',
        level: 2,
        school: 'I',
        entries: [
          "Each time a creature hits you with an attack roll, roll a {@dice d6} for each of your remaining duplicates. If any of the d6s rolls a 3 or higher, one of the duplicates is hit instead of you.",
        ],
      },
      ['wizard']
    );
    expect(spell.damage).toBeUndefined();
    expect(spell.healing).toBeUndefined();
    expect(spell.automation).toBe('manual');
  });

  it('лечение берётся из {@dice} с контекстом «regains … Hit Points»', () => {
    const spell = normalizeSpell(
      {
        name: 'Cure Wounds',
        source: 'XPHB',
        level: 1,
        school: 'A',
        entries: ['The target regains {@dice 2d8} + your spellcasting ability modifier Hit Points.'],
      },
      ['cleric']
    );
    expect(spell.damage?.dice).toEqual(['2d8']);
    expect(spell.healing).toBe(true);
  });
});

describe('deriveAreaSpec', () => {
  const point = (text: string) =>
    deriveAreaSpec({ type: 'point', distance: { type: 'feet', amount: 90 } }, text.toLowerCase());

  it('квадрат из текста ("20-foot square")', () => {
    expect(point('grasping plants sprout in a 20-foot square within range')).toEqual({ shape: 'cube', size: 20 });
    expect(point('grease covers the ground in a 10-foot square')).toEqual({ shape: 'cube', size: 10 });
  });

  it('радиус, куб, конус, линия', () => {
    expect(point('a 20-foot-radius sphere')).toEqual({ shape: 'sphere', size: 20 });
    expect(point('a 15-foot cube')).toEqual({ shape: 'cube', size: 15 });
    expect(point('a 30-foot cone')).toEqual({ shape: 'cone', size: 30 });
    expect(point('a 60-foot line')).toEqual({ shape: 'line', size: 60, width: 5 });
  });
});
