import { describe, expect, it } from 'vitest';
import { syncChoiceDamage } from './choices';
import type { SpellDef } from './materialize';

function makeDef(types: unknown[], choices?: unknown[]): SpellDef {
  return {
    key: 'CUSTOM:Test',
    name: 'Test',
    source: 'CUSTOM',
    level: 1,
    school: 'Evocation',
    time: [{ number: 1, unit: 'action' }],
    range: { type: 'point', distance: { type: 'feet', amount: 60 } },
    components: {},
    duration: [{ type: 'instant' }],
    classes: [],
    description: [''],
    automation: {
      primary: 'save',
      save: { ability: 'dex' },
      damage: { dice: { ref: 'spellDamage' }, types },
      ...(choices ? { choices } : {}),
    },
  } as unknown as SpellDef;
}

describe('syncChoiceDamage (выбор типа урона при касте)', () => {
  it('привязывает литеральный тип к damageType-выбору с fallback', () => {
    const def = makeDef(['fire'], [{ id: 'damageType', param: 'damageType', options: ['fire', 'cold'] }]);
    const synced = syncChoiceDamage(def);
    expect(synced.automation.damage && 'dice' in synced.automation.damage && synced.automation.damage.types).toEqual([
      { ref: 'choice', choice: 'damageType', fallback: 'fire' },
    ]);
  });

  it('раскрывает ссылку обратно, когда выбор убрали', () => {
    const def = makeDef([{ ref: 'choice', choice: 'damageType', fallback: 'cold' }]);
    const synced = syncChoiceDamage(def);
    expect(synced.automation.damage && 'dice' in synced.automation.damage && synced.automation.damage.types).toEqual([
      'cold',
    ]);
  });

  it('не трогает запись без выбора и без ссылки', () => {
    const def = makeDef(['fire']);
    expect(syncChoiceDamage(def)).toBe(def);
  });
});
