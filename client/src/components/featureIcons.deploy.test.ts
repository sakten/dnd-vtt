import { describe, expect, it } from 'vitest';
import { CLASSES, classFeatures, type ClassLevel } from 'shared';
import { FEATURE_ICONS } from './featureIcons';

/** Классы, у которых уникальные иконки уже нарисованы (партии R8.8). */
const PROCESSED = new Set(['barbarian', 'fighter']);

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

describe('иконки способностей (R8.8)', () => {
  it('каждая активная кнопка обработанных классов имеет уникальную иконку', () => {
    const missing: string[] = [];
    for (const classKey of PROCESSED) {
      for (const id of featureIds(classKey, 12)) if (!(id in FEATURE_ICONS)) missing.push(id);
    }
    expect(missing).toEqual([]);
  });

  it('нет иконок без кнопок', () => {
    const all = new Set<string>();
    for (const classKey of Object.keys(CLASSES)) {
      for (const id of featureIds(classKey, 12)) all.add(id);
    }
    expect(Object.keys(FEATURE_ICONS).filter((id) => !all.has(id))).toEqual([]);
  });
});
