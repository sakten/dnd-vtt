import { describe, expect, it } from 'vitest';
import spellsData from '../data/spells.json';
import textData from '../data/text.ru.json';
import featsData from '../data/feats.json';
import featuresData from '../data/features.json';
import weaponsData from '../data/weapons.json';
import { featNameRu, featureNameRu, spellNameRu, weaponNameRu } from './text';

const catalog = spellsData.spells;

describe('spellNameRu', () => {
  it('у каждого заклинания каталога есть непустое русское название', () => {
    const missing = catalog.filter((s) => !spellNameRu(s.key)?.trim()).map((s) => s.key);
    expect(missing).toEqual([]);
  });

  it('число переводов совпадает с числом заклинаний каталога', () => {
    expect(Object.keys(textData.spells)).toHaveLength(catalog.length);
  });

  it('все ключи переводов есть в каталоге', () => {
    const keys = new Set(catalog.map((s) => s.key));
    expect(Object.keys(textData.spells).filter((k) => !keys.has(k))).toEqual([]);
  });

  it('русские названия не дублируются', () => {
    const names = catalog.map((s) => spellNameRu(s.key));
    expect(new Set(names).size).toBe(catalog.length);
    expect(names.every((n) => typeof n === 'string' && n.length > 0)).toBe(true);
  });

  it('формат: с заглавной буквы, без точки на конце', () => {
    const bad = Object.entries(textData.spells)
      .filter(([, name]) => !/^[А-ЯЁ]/.test(name) || name.endsWith('.'))
      .map(([key]) => key);
    expect(bad).toEqual([]);
  });
});

describe('featureNameRu', () => {
  it('у каждой черты каталога есть непустое русское название', () => {
    const missing = featuresData.features.filter((f) => !featureNameRu(f.key)?.trim()).map((f) => f.key);
    expect(missing).toEqual([]);
  });

  it('число переводов совпадает с числом черт каталога', () => {
    expect(featuresData.features).toHaveLength(featuresData.count);
    expect(Object.keys(textData.features)).toHaveLength(featuresData.features.length);
  });

  it('формат: с заглавной буквы, без точки на конце', () => {
    const bad = Object.entries(textData.features)
      .filter(([, name]) => !/^[А-ЯЁ]/.test(name) || name.endsWith('.'))
      .map(([key]) => key);
    expect(bad).toEqual([]);
  });
});

describe('featNameRu / weaponNameRu', () => {
  it('у каждого фита и оружия есть непустое русское название', () => {
    expect(featsData.feats.filter((f) => !featNameRu(f.key)?.trim()).map((f) => f.key)).toEqual([]);
    expect(weaponsData.weapons.filter((w) => !weaponNameRu(w.key)?.trim()).map((w) => w.key)).toEqual([]);
  });

  it('число переводов совпадает с числом записей каталогов', () => {
    expect(Object.keys(textData.feats)).toHaveLength(featsData.feats.length);
    expect(Object.keys(textData.weapons)).toHaveLength(weaponsData.weapons.length);
  });

  it('названия не дублируются', () => {
    const feats = featsData.feats.map((f) => featNameRu(f.key));
    const weapons = weaponsData.weapons.map((w) => weaponNameRu(w.key));
    expect(new Set(feats).size).toBe(featsData.feats.length);
    expect(new Set(weapons).size).toBe(weaponsData.weapons.length);
  });
});
