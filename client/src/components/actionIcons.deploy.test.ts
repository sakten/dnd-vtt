import { describe, expect, it } from 'vitest';
import { automationForSpell, type AutomationDef, type Spell } from 'shared';
import spellsData from 'shared/spellsData';
import { ACTION_ICONS, ACTION_ICON_FALLBACKS } from './actionIcons';

/** Ключи действий (`<заклинание>:<id>`), которые выдают каталог и деривация. */
function actionKeys(def: AutomationDef): string[] {
  const keys: string[] = [];
  for (const effect of def.effects ?? []) {
    for (const action of effect.actions ?? []) keys.push(`${def.key}:${action.id}`);
    if (effect.escape?.iconKey) keys.push(effect.escape.iconKey);
  }
  for (const action of def.zone?.actions ?? []) keys.push(`${def.key}:${action.id}`);
  return keys;
}

describe('иконки действий заклинаний (деплой)', () => {
  const all = new Set<string>();
  for (const spell of spellsData.spells as Spell[]) {
    for (const key of actionKeys(automationForSpell(spell))) all.add(key);
  }

  it('каждое выданное действие имеет цветную иконку (точную или запасную)', () => {
    const missing = [...all].filter((key) => {
      const actionId = key.slice(key.lastIndexOf(':') + 1);
      return !(key in ACTION_ICONS) && !(actionId in ACTION_ICON_FALLBACKS);
    });
    expect(missing).toEqual([]);
  });

  it('нет иконок без действий', () => {
    expect(Object.keys(ACTION_ICONS).filter((key) => !all.has(key))).toEqual([]);
  });
});
