import { describe, expect, it } from 'vitest';
import type { BestiaryEntry } from '../domain/bestiary';
import { applyRest } from './resources';
import {
  crValue,
  druidLevelOf,
  hasMoonCircle,
  knownShapeLimit,
  polymorphFormIssue,
  wildShapeFormIssue,
  wildShapeLimit,
  wildShapeTempHp,
} from './wildShape';

const beast = (over: Partial<BestiaryEntry> = {}): BestiaryEntry =>
  ({
    key: 'XMM:Wolf',
    name: 'Wolf',
    source: 'XMM',
    size: 'M',
    type: 'beast',
    cr: '1/4',
    immunities: [],
    resistances: [],
    vulnerabilities: [],
    ac: 13,
    hpAverage: 11,
    hpFormula: '2d8+2',
    abilities: { str: 14, dex: 15, con: 12, int: 3, wis: 12, cha: 6 },
    cells: 1,
    speed: 40,
    senses: [],
    attacks: [],
    actions: [],
    description: '',
    appearance: '',
    ...over,
  }) as BestiaryEntry;

describe('Wild Shape: таблицы уровней (XPHB 2024)', () => {
  it('до 2 уровня дикий облик недоступен', () => {
    expect(wildShapeLimit(1)).toBeUndefined();
    expect(knownShapeLimit(1)).toBe(0);
  });

  it('Beast Shapes: формы/CR/полёт по уровням', () => {
    expect(wildShapeLimit(2)).toMatchObject({ known: 4, maxCr: 0.25, fly: false });
    expect(wildShapeLimit(4)).toMatchObject({ known: 6, maxCr: 0.5, fly: false });
    expect(wildShapeLimit(8)).toMatchObject({ known: 8, maxCr: 1, fly: true });
    expect(wildShapeLimit(20)).toMatchObject({ known: 8, maxCr: 1, fly: true });
  });

  it('круг луны: CR = ⌊уровень/3⌋, но не ниже таблицы', () => {
    expect(wildShapeLimit(3, true)).toMatchObject({ maxCr: 1, fly: false });
    expect(wildShapeLimit(4, true)).toMatchObject({ maxCr: 1, fly: false });
    expect(wildShapeLimit(6, true)).toMatchObject({ maxCr: 2, fly: false });
    expect(wildShapeLimit(8, true)).toMatchObject({ maxCr: 2, fly: true });
    expect(wildShapeLimit(9, true)?.maxCr).toBe(3);
    expect(wildShapeLimit(18, true)?.maxCr).toBe(6);
  });

  it('temp HP: уровень друида, у круга луны — тройной', () => {
    expect(wildShapeTempHp(7)).toBe(7);
    expect(wildShapeTempHp(7, true)).toBe(21);
    expect(wildShapeTempHp(20, true)).toBe(60);
  });

  it('CR строкой в число', () => {
    expect(crValue('0')).toBe(0);
    expect(crValue('1/8')).toBe(0.125);
    expect(crValue('1/2')).toBe(0.5);
    expect(crValue('13')).toBe(13);
    expect(crValue('')).toBe(0);
  });
});

describe('Wild Shape: пригодность формы', () => {
  it('только звери, CR в лимите, полёт с 8 уровня', () => {
    const low = wildShapeLimit(2)!;
    expect(wildShapeFormIssue(beast(), low)).toBeUndefined();
    expect(wildShapeFormIssue(beast({ type: 'fiend' }), low)).toBe('shapeNoBeast');
    expect(wildShapeFormIssue(beast({ cr: '1' }), low)).toBe('shapeTooBig');
    expect(wildShapeFormIssue(beast({ fly: true }), low)).toBe('shapeNoFly');

    const high = wildShapeLimit(8)!;
    expect(wildShapeFormIssue(beast({ fly: true, cr: '1' }), high)).toBeUndefined();
  });

  it('круг луны поднимает CR, но полёт остаётся по таблице', () => {
    const moon6 = wildShapeLimit(6, true)!;
    expect(wildShapeFormIssue(beast({ cr: '2' }), moon6)).toBeUndefined();
    expect(wildShapeFormIssue(beast({ cr: '2', fly: true }), moon6)).toBe('shapeNoFly');
    expect(wildShapeFormIssue(beast({ cr: '3' }), moon6)).toBe('shapeTooBig');
  });

  it('Polymorph: CR цели, полёт разрешён', () => {
    expect(polymorphFormIssue(beast({ cr: '1/4', fly: true }), 0.25)).toBeUndefined();
    expect(polymorphFormIssue(beast({ cr: '1' }), 0.25)).toBe('shapeTooBig');
    expect(polymorphFormIssue(beast({ type: 'undead' }), 1)).toBe('shapeNoBeast');
  });
});

describe('Wild Shape: уровни и подкласс', () => {
  it('короткий отдых: +1 использование, длинный — все', () => {
    const base = {
      hp: { current: 10, max: 20, temp: 0, deathSuccesses: 0, deathFailures: 0 },
      hitDice: [],
      spellSlots: [],
      pact: { current: 0, max: 0, level: 0 },
      notes: '',
      resources: [
        { id: 'w', key: 'druid:wildShape', name: 'Дикий облик', current: 0, max: 3, reset: 'short' as const, auto: true },
      ],
    };
    expect(applyRest(base, 'short').resources[0]!.current).toBe(1);
    expect(applyRest(base, 'long').resources[0]!.current).toBe(3);
  });

  it('уровень друида и круг луны из классов листа', () => {
    const classes = [{ className: 'druid', level: 7, subclass: 'moon' }];
    expect(druidLevelOf(classes)).toBe(7);
    expect(hasMoonCircle(classes)).toBe(true);
    expect(druidLevelOf([{ className: 'wizard', level: 5 }])).toBe(0);
    expect(hasMoonCircle([{ className: 'druid', level: 5, subclass: 'land' }])).toBe(false);
    expect(druidLevelOf(undefined)).toBe(0);
  });
});
