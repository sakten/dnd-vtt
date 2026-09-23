import { describe, expect, it } from 'vitest';
import type { ConditionInstance, EffectInstance } from 'shared';
import { makeToken } from '../test/fixtures';
import { invisibilityViewFor, tokenInvisible } from './visibility';

const invisibleCond: ConditionInstance = { key: 'invisible', name: 'РќРµРІРёРґРёРј' };

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
