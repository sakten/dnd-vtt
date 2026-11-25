import { describe, expect, it } from 'vitest';
import { MAX_FEATURE_CHOICES, MAX_INVOCATIONS, MAX_SHAPE_FORMS } from '../domain/core';
import { normalizeInvocations, normalizeSheetChoices, normalizeWildShape } from './sheet';

describe('normalizeInvocations', () => {
  it('не массив — пустой список', () => {
    expect(normalizeInvocations(undefined)).toEqual([]);
    expect(normalizeInvocations({})).toEqual([]);
  });

  it('оставляет валидные ключи и убирает мусор/дубли', () => {
    expect(
      normalizeInvocations([
        'XPHB:Agonizing Blast',
        null,
        42,
        'без-префикса',
        'XPHB:Agonizing Blast',
        `XPHB:${'x'.repeat(90)}`,
      ])
    ).toEqual(['XPHB:Agonizing Blast']);
  });

  it('ограничивает список лимитом', () => {
    const raw = Array.from({ length: MAX_INVOCATIONS + 5 }, (_, index) => `XPHB:Invocation ${index}`);
    expect(normalizeInvocations(raw)).toHaveLength(MAX_INVOCATIONS);
  });
});

describe('normalizeSheetChoices', () => {
  it('фильтрует неизвестные виды, пустые ключи и дубли с учётом списка', () => {
    expect(
      normalizeSheetChoices([
        { kind: 'feat', key: 'Magic Initiate', list: 'wizard', spells: ['Fire Bolt'] },
        { kind: 'feat', key: 'Magic Initiate', list: 'wizard' },
        { kind: 'feat', key: 'Magic Initiate', list: 'cleric' },
        { kind: 'unknown', key: 'X' },
        { kind: 'feat', key: '  ' },
        null,
        'bad',
      ])
    ).toEqual([
      { kind: 'feat', key: 'Magic Initiate', list: 'wizard', spells: ['Fire Bolt'] },
      { kind: 'feat', key: 'Magic Initiate', list: 'cleric' },
    ]);
  });

  it('валидирует характеристику, чистит и дедуплицирует заклинания', () => {
    const [choice] = normalizeSheetChoices([
      {
        kind: 'feat',
        key: ' Magic Initiate ',
        ability: 'str',
        spells: [' Fire Bolt ', 'Fire Bolt', '', 42, 'Light', 'Mage Hand', 'Minor Illusion', 'Prestidigitation'],
      },
      { kind: 'feat', key: 'Other', ability: 'luck' },
    ]);
    expect(choice).toEqual({
      kind: 'feat',
      key: 'Magic Initiate',
      ability: 'str',
      spells: ['Fire Bolt', 'Light', 'Mage Hand', 'Minor Illusion'],
    });
    expect(normalizeSheetChoices([{ kind: 'feat', key: 'Other', ability: 'luck' }])).toEqual([
      { kind: 'feat', key: 'Other' },
    ]);
  });

  it('ограничивает число выборов', () => {
    const raw = Array.from({ length: MAX_FEATURE_CHOICES + 3 }, (_, index) => ({
      kind: 'feat',
      key: `Feat ${index}`,
    }));
    expect(normalizeSheetChoices(raw)).toHaveLength(MAX_FEATURE_CHOICES);
  });
});

describe('normalizeWildShape', () => {
  it('не объект или без known — undefined', () => {
    expect(normalizeWildShape(null)).toBeUndefined();
    expect(normalizeWildShape({})).toBeUndefined();
    expect(normalizeWildShape({ known: 'bear' })).toBeUndefined();
  });

  it('чистит known, убирает дубли и ограничивает формы', () => {
    expect(
      normalizeWildShape({
        known: ['XPHB:Brown Bear', 'XPHB:Brown Bear', 'bear', `XPHB:${'x'.repeat(90)}`],
      })
    ).toEqual({ known: ['XPHB:Brown Bear'] });

    const raw = Array.from({ length: MAX_SHAPE_FORMS + 3 }, (_, index) => `XPHB:Form ${index}`);
    expect(normalizeWildShape({ known: raw })).toEqual({ known: raw.slice(0, MAX_SHAPE_FORMS) });
    expect(normalizeWildShape({ known: [] })).toEqual({});
  });
});
