import { describe, expect, it } from 'vitest';
import spellsData from '../data/spells.json';
import textData from '../data/text.ru.json';
import { spellNameRu } from './text';

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
