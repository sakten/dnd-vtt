import { describe, expect, it } from 'vitest';
import type { ConditionInstance, EffectInstance } from 'shared';
import { makeToken } from '../test/fixtures';
import { invisibilityViewFor, tokenHidden, tokenInvisible } from './visibility';

const invisibleCond: ConditionInstance = { key: 'invisible', name: 'Невидим' };
const hiddenCond: ConditionInstance = { key: 'hidden', name: 'Скрытый' };

const seeInvisibleEffect: EffectInstance = {
  id: 'see',
  name: 'See Invisibility',
  duration: { type: 'permanent' },
  modifiers: [],
  seesInvisible: true,
};

describe('РЅРµРІРёРґРёРјРѕСЃС‚СЊ: РєС‚Рѕ С‡С‚Рѕ РІРёРґРёС‚', () => {
  it('СѓСЃР»РѕРІРёРµ invisible вЂ” РµРґРёРЅСЃС‚РІРµРЅРЅС‹Р№ РёСЃС‚РѕС‡РЅРёРє СЃРєСЂС‹С‚РёСЏ', () => {
    expect(tokenInvisible(makeToken('t1'))).toBe(false);
    expect(tokenInvisible(makeToken('t1', { conditions: [invisibleCond] }))).toBe(true);
  });

  it('С‡СѓР¶РёРј СЃРєСЂС‹С‚, РєРѕРЅС‚СЂРѕР»С‘СЂСѓ Рё DM вЂ” РІРёРґРµРЅ', () => {
    const ghost = makeToken('ghost', { conditions: [invisibleCond] });
    const hero = makeToken('hero', { faction: 'ally' });

    expect(invisibilityViewFor([ghost, hero], [hero], false).hidden.has('ghost')).toBe(true);
    expect(invisibilityViewFor([ghost, hero], [ghost], false).hidden.size).toBe(0);
    expect(invisibilityViewFor([ghost, hero], [], true).hidden.size).toBe(0);
  });

  it('See Invisibility Сѓ СЃРІРѕРµРіРѕ С‚РѕРєРµРЅР° СЂР°СЃРєСЂС‹РІР°РµС‚ РІСЃРµС… РЅРµРІРёРґРёРјС‹С…', () => {
    const ghost = makeToken('ghost', { conditions: [invisibleCond] });
    const seer = makeToken('seer', { effects: [seeInvisibleEffect] });

    expect(invisibilityViewFor([ghost, seer], [seer], false).hidden.size).toBe(0);
  });

  it('РІ С‚СЂРµРєРµСЂРµ РјР°СЃРєРёСЂСѓСЋС‚СЃСЏ РІСЂР°РіРё Рё РЅРµР№С‚СЂР°Р»С‹, СЃРѕСЋР·РЅРёРєРё вЂ” РЅРµС‚', () => {
    const enemy = makeToken('enemy', { conditions: [invisibleCond], faction: 'enemy' });
    const neutral = makeToken('neutral', { conditions: [invisibleCond], faction: 'neutral' });
    const friend = makeToken('friend', { conditions: [invisibleCond], faction: 'ally' });
    const hero = makeToken('hero', { faction: 'ally' });

    const view = invisibilityViewFor([enemy, neutral, friend, hero], [hero], false);
    expect([...view.hidden].sort()).toEqual(['enemy', 'friend', 'neutral']);
    expect([...view.masked].sort()).toEqual(['enemy', 'neutral']);
  });

  it('Р±РµР· СЃРІРѕРёС… С‚РѕРєРµРЅРѕРІ РјР°СЃРєРёСЂСѓСЋС‚СЃСЏ РІСЃРµ СЃРєСЂС‹С‚С‹Рµ', () => {
    const ghost = makeToken('ghost', { conditions: [invisibleCond], faction: 'ally' });
    const view = invisibilityViewFor([ghost], [], false);
    expect(view.masked.has('ghost')).toBe(true);
  });
});

describe('скрытность: видно с соседней клетки или истинным зрением', () => {
  it('условие hidden — источник скрытности', () => {
    expect(tokenHidden(makeToken('t1'))).toBe(false);
    expect(tokenHidden(makeToken('t1', { conditions: [hiddenCond] }))).toBe(true);
  });

  it('соседняя клетка (5 фт) раскрывает, две клетки (10 фт) — нет', () => {
    const near = makeToken('near', { conditions: [hiddenCond], faction: 'enemy', x: 50 });
    const far = makeToken('far', { conditions: [hiddenCond], faction: 'enemy', x: 150 });
    const hero = makeToken('hero', { faction: 'ally', x: 0 });

    const nearView = invisibilityViewFor([near, hero], [hero], false);
    expect(nearView.hidden.has('near')).toBe(false);
    const farView = invisibilityViewFor([far, hero], [hero], false);
    expect(farView.hidden.has('far')).toBe(true);
    expect(farView.masked.has('far')).toBe(true);
  });

  it('истинное зрение раскрывает в пределах дальности, дальше — нет', () => {
    const hidden = makeToken('hidden', { conditions: [hiddenCond], faction: 'enemy', x: 250 }); // 25 фт
    const seer = makeToken('seer', { faction: 'ally', x: 0, senses: [{ type: 'truesight', range: 60 }] });
    const weak = makeToken('weak', { faction: 'ally', x: 0, senses: [{ type: 'truesight', range: 10 }] });

    expect(invisibilityViewFor([hidden, seer], [seer], false).hidden.size).toBe(0);
    expect(invisibilityViewFor([hidden, weak], [weak], false).hidden.has('hidden')).toBe(true);
    // Тёмное зрение скрытого не раскрывает.
    const dark = makeToken('dark', { faction: 'ally', x: 0, senses: [{ type: 'darkvision', range: 120 }] });
    expect(invisibilityViewFor([hidden, dark], [dark], false).hidden.has('hidden')).toBe(true);
  });

  it('See Invisibility у своего токена раскрывает скрытого на любой дистанции', () => {
    const hidden = makeToken('hidden', { conditions: [hiddenCond], faction: 'enemy', x: 500 });
    const seer = makeToken('seer', { faction: 'ally', x: 0, effects: [seeInvisibleEffect] });
    expect(invisibilityViewFor([hidden, seer], [seer], false).hidden.size).toBe(0);
  });
});
