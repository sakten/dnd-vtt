import { describe, expect, it } from 'vitest';
import {
  ATTACK_RIDERS,
  CLASSES,
  RACES,
  classFeatures,
  raceActions,
  raceChoiceDefs,
  type ClassLevel,
  type RaceSelection,
} from 'shared';
import { FEATURE_ICONS } from './featureIcons';

/** Классы, у которых уникальные иконки уже нарисованы (партии R8.8). */
const PROCESSED = new Set(['barbarian', 'fighter', 'monk']);

/** Id всех активных кнопок класса на уровне (сам класс + каждый подкласс). */
function featureIds(classKey: string, level: number): Set<string> {
  const subclasses = Object.keys(CLASSES[classKey]?.subclasses ?? {});
  const variants: ClassLevel[][] = [[{ className: classKey, level }]];
  for (const subclass of subclasses) variants.push([{ className: classKey, level, subclass }]);
  const ids = new Set<string>();
  for (const classes of variants) {
    for (const action of classFeatures(classes)) ids.add(action.id);
  }
  return ids;
}

/** Id активных кнопок всех видов (первый вариант каждого выбора). */
function raceIds(): Set<string> {
  const ids = new Set<string>();
  for (const race of RACES) {
    const choices: Record<string, string> = {};
    for (const choice of raceChoiceDefs(race.key)) {
      const first = choice.options[0];
      if (first) choices[choice.id] = first.key;
    }
    const selection: RaceSelection = { key: race.key, choices };
    for (const action of raceActions(selection, [{ level: 12 }])) ids.add(action.id);
  }
  return ids;
}

describe('иконки способностей (R8.8)', () => {
  it('каждая активная кнопка обработанных классов имеет уникальную иконку', () => {
    const missing: string[] = [];
    for (const classKey of PROCESSED) {
      for (const id of featureIds(classKey, 12)) if (!(id in FEATURE_ICONS)) missing.push(id);
    }
    expect(missing).toEqual([]);
  });

  it('каждая активная расовая кнопка имеет уникальную иконку', () => {
    const missing = [...raceIds()].filter((id) => !(id in FEATURE_ICONS));
    expect(missing).toEqual([]);
  });

  it('нет иконок без кнопок', () => {
    const all = new Set<string>();
    for (const classKey of Object.keys(CLASSES)) {
      for (const id of featureIds(classKey, 12)) all.add(id);
    }
    for (const id of raceIds()) all.add(id);
    for (const rider of ATTACK_RIDERS) all.add(rider.id);
    expect(Object.keys(FEATURE_ICONS).filter((id) => !all.has(id))).toEqual([]);
  });
});
