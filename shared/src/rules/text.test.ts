import { describe, expect, it } from 'vitest';
import spellsData from '../data/spells.json';
import featsData from '../data/feats.json';
import featuresData from '../data/features.json';
import weaponsData from '../data/weapons.json';
import textNames from '../data/text.ru/names.json';
import spellText from '../data/text.ru/spells.json';
import featText from '../data/text.ru/feats.json';
import {
  featDescription,
  featName,
  featPrereq,
  featureDescription,
  featureName,
  isNamesLoaded,
  loadFeatText,
  loadFeatureText,
  loadNames,
  loadSpellText,
  spellDescription,
  spellHigherLevel,
  spellName,
  weaponName,
} from './text';

const LANG = 'ru';
const catalog = spellsData.spells;

describe('мультиязычный слой оверлеев', () => {
  it('до загрузки имён и описаний оверлея нет', () => {
    expect(isNamesLoaded('de')).toBe(false);
    expect(spellName('XPHB:Fireball', LANG)).toBeUndefined();
    expect(spellDescription("XPHB:Hunter's Mark", LANG)).toBeUndefined();
  });

  it('неизвестный (непоставленный) язык: загрузка без падения, геттеры → undefined', async () => {
    await loadNames('de');
    await loadSpellText('de');
    await loadFeatText('de');
    await loadFeatureText('de', 'fighter');
    expect(spellName('XPHB:Fireball', 'de')).toBeUndefined();
    expect(spellDescription('XPHB:Fireball', 'de')).toBeUndefined();
    expect(featDescription('XPHB:alert', 'de')).toBeUndefined();
    expect(featureDescription('fighter:secondWind', 'de')).toBeUndefined();
  });
});

describe('spellName / имена контента', () => {
  it('после загрузки: у каждого заклинания есть непустое имя', async () => {
    await loadNames(LANG);
    const missing = catalog.filter((s) => !spellName(s.key, LANG)?.trim()).map((s) => s.key);
    expect(missing).toEqual([]);
  });

  it('число переводов совпадает с числом записей каталогов', async () => {
    await loadNames(LANG);
    expect(Object.keys(textNames.spells)).toHaveLength(catalog.length);
    expect(Object.keys(textNames.features)).toHaveLength(featuresData.features.length);
    expect(Object.keys(textNames.feats)).toHaveLength(featsData.feats.length);
    expect(Object.keys(textNames.weapons)).toHaveLength(weaponsData.weapons.length);
  });

  it('все ключи переводов есть в каталогах', async () => {
    await loadNames(LANG);
    const spellKeys = new Set(catalog.map((s) => s.key));
    const featureKeys = new Set(featuresData.features.map((f) => f.key));
    const featKeys = new Set(featsData.feats.map((f) => f.key));
    const weaponKeys = new Set(weaponsData.weapons.map((w) => w.key));
    expect(Object.keys(textNames.spells).filter((k) => !spellKeys.has(k))).toEqual([]);
    expect(Object.keys(textNames.features).filter((k) => !featureKeys.has(k))).toEqual([]);
    expect(Object.keys(textNames.feats).filter((k) => !featKeys.has(k))).toEqual([]);
    expect(Object.keys(textNames.weapons).filter((k) => !weaponKeys.has(k))).toEqual([]);
  });

  it('формат имён: с заглавной буквы, без точки на конце', async () => {
    await loadNames(LANG);
    const bad = [...Object.entries(textNames.spells), ...Object.entries(textNames.features)]
      .filter(([, name]) => !/^[А-ЯЁ]/.test(name) || name.endsWith('.'))
      .map(([key]) => key);
    expect(bad).toEqual([]);
  });

  it('имена не дублируются', async () => {
    await loadNames(LANG);
    const spells = catalog.map((s) => spellName(s.key, LANG));
    const feats = featsData.feats.map((f) => featName(f.key, LANG));
    const weapons = weaponsData.weapons.map((w) => weaponName(w.key, LANG));
    expect(new Set(spells).size).toBe(catalog.length);
    expect(new Set(feats).size).toBe(featsData.feats.length);
    expect(new Set(weapons).size).toBe(weaponsData.weapons.length);
    expect(featureName('fighter:secondWind', LANG)).toBeTruthy();
  });
});

describe('spellDescription (ленивый чанк)', () => {
  it('после загрузки: у каждого заклинания непустое описание', async () => {
    await loadSpellText(LANG);
    const missing = catalog
      .filter((s) => {
        const ru = spellDescription(s.key, LANG);
        return !ru?.length || ru.some((p) => !p.trim());
      })
      .map((s) => s.key);
    expect(missing).toEqual([]);
    expect(Object.keys(spellText.spellDescriptions)).toHaveLength(catalog.length);
    expect(spellDescription("XPHB:Hunter's Mark", LANG)?.length).toBeGreaterThan(0);
    expect(spellDescription('unknown', LANG)).toBeUndefined();
  });

  it('все ключи описаний и higherLevel есть в каталоге', () => {
    const keys = new Set(catalog.map((s) => s.key));
    expect(Object.keys(spellText.spellDescriptions).filter((k) => !keys.has(k))).toEqual([]);
    expect(Object.keys(spellText.spellHigherLevel).filter((k) => !keys.has(k))).toEqual([]);
  });

  it('higherLevel: непустые абзацы', () => {
    const bad = Object.entries(spellText.spellHigherLevel)
      .filter(([, paras]) => !paras.length || paras.some((p) => !p.trim()))
      .map(([key]) => key);
    expect(bad).toEqual([]);
    expect(spellHigherLevel("XPHB:Hunter's Mark", LANG)).toBeTruthy();
    expect(spellHigherLevel('unknown', LANG)).toBeUndefined();
  });

  it('нет остатков HTML и сущностей', () => {
    const bad: string[] = [];
    const higher = spellText.spellHigherLevel as Record<string, string[]>;
    for (const [key, paras] of Object.entries(spellText.spellDescriptions)) {
      const joined = [...paras, ...(higher[key] ?? [])].join(' ');
      if (/<[a-z/][^>]*>/i.test(joined) || /&(amp|quot|laquo|nbsp|#\d+);/.test(joined)) bad.push(key);
    }
    expect(bad).toEqual([]);
  });
});

describe('featureDescription (по классам)', () => {
  it('валидность и полное покрытие после загрузки всех классов', async () => {
    const classes = [...new Set(featuresData.features.map((f) => f.className))];
    await Promise.all(classes.map((c) => loadFeatureText(LANG, c)));
    const bad = featuresData.features
      .filter((f) => {
        const d = featureDescription(f.key, LANG);
        return !d?.trim() || /<[a-z/][^>]*>|&(amp|quot|laquo|nbsp|#\d+);/.test(d);
      })
      .map((f) => f.key);
    expect(bad).toEqual([]);
    expect(featureDescription('unknown', LANG)).toBeUndefined();
  });
});

describe('featDescription / featPrereq', () => {
  it('описания фитов: валидность и полное покрытие', async () => {
    await loadFeatText(LANG);
    const keys = new Set(featsData.feats.map((f) => f.key));
    expect(Object.keys(featText.featDescriptions).filter((k) => !keys.has(k))).toEqual([]);
    const bad = Object.entries(featText.featDescriptions).filter(
      ([, d]) => !d.trim() || /<[a-z/][^>]*>|&(amp|quot|laquo|nbsp|#\d+);/.test(d)
    );
    expect(bad).toEqual([]);
    const missing = featsData.feats.filter((f) => !featDescription(f.key, LANG)?.trim()).map((f) => f.key);
    expect(missing).toEqual([]);
    expect(featDescription('unknown', LANG)).toBeUndefined();
  });

  it('требования фитов: оверлей покрывает все записи с prereq', async () => {
    await loadFeatText(LANG);
    const keys = new Set(featsData.feats.map((f) => f.key));
    expect(Object.keys(featText.featPrereq).filter((k) => !keys.has(k))).toEqual([]);
    const withPrereq = featsData.feats.filter((f) => f.prereq);
    expect(withPrereq.length).toBeGreaterThan(0);
    const missing = withPrereq.filter((f) => !featPrereq(f.key, LANG)?.trim()).map((f) => f.key);
    expect(missing).toEqual([]);
    expect(featPrereq('unknown', LANG)).toBeUndefined();
  });
});
