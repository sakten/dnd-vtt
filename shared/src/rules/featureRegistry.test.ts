import { describe, expect, it } from 'vitest';
import namesData from '../data/text.ru/names.json';
import { FEATURE_META } from './classActions';
import { FEATURE_MECHANICS } from './featureAutomation';
import { FEATURES } from './features';
import { MANEUVERS_META } from './maneuvers';

const featureKeys = new Set(FEATURES.map((f) => f.key));
const ruNames = (namesData as unknown as { features: Record<string, string>; maneuvers: Record<string, string> });

/** Под-действия составных фич: своей записи в каталоге черт нет. */
const NON_CATALOG = new Set(['wizard.scribes:manifestMindConjure']);

/** Действия пулов (`monk:focus/...`): собираются из именованных черт, не из каталога. */
const isPoolAction = (key: string): boolean => key.includes('/');

describe('регистрация фич: метаданные не дублируются', () => {
  it('FEATURE_META и FEATURE_MECHANICS не пересекаются', () => {
    const both = Object.keys(FEATURE_META).filter((key) => key in FEATURE_MECHANICS);
    expect(both).toEqual([]);
  });

  it('записи FEATURE_META указывают на черту с RU-именем (кроме под-действий)', () => {
    for (const key of Object.keys(FEATURE_META)) {
      if (NON_CATALOG.has(key)) continue;
      expect(featureKeys.has(key), `нет в каталоге: ${key}`).toBe(true);
      expect(ruNames.features[key], `нет RU-имени: ${key}`).toBeTruthy();
    }
  });

  it('записи FEATURE_MECHANICS указывают на черту с RU-именем (кроме действий пулов)', () => {
    for (const key of Object.keys(FEATURE_MECHANICS)) {
      if (isPoolAction(key)) continue;
      expect(featureKeys.has(key), `нет в каталоге: ${key}`).toBe(true);
      expect(ruNames.features[key], `нет RU-имени: ${key}`).toBeTruthy();
    }
  });

  it('манёвры: RU-имена совпадают с метаданными каталога', () => {
    for (const meta of MANEUVERS_META) {
      expect(ruNames.maneuvers[meta.key], `нет RU-имени: ${meta.key}`).toBe(meta.name);
    }
  });
});
