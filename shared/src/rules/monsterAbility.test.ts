import { describe, expect, it } from 'vitest';
import type { ActionDef } from '../domain/actions';
import { DEFAULT_ABILITIES } from '../domain/core';
import type { TokenStatblock } from '../domain/token';
import { legendaryOnly, minLegendaryCost, monsterAbilityAutomation, monsterStats } from './monsterAbility';

function makeAction(over: Partial<ActionDef> = {}): ActionDef {
  return { id: 'a1', name: 'Яд', source: 'monster', costs: ['action'], ...over };
}

describe('monsterAbilityAutomation', () => {
  it('атака: попадание, урон и эффект по сейву', () => {
    const action = makeAction({
      ability: {
        targeting: { kind: 'creature', range: 5, targets: 2 },
        attack: { rangeType: 'melee', bonus: '+5', damage: '1d6+3', types: ['piercing'] },
        save: { ability: 'con' },
        effects: [{ condition: 'poisoned', duration: { type: 'rounds', rounds: 2 } }],
      },
    });
    const def = monsterAbilityAutomation(action)!;
    expect(def.resolution).toBe('attack');
    expect(def.attack).toEqual({ rangeType: 'melee' });
    expect(def.count).toBe(2);
    expect(def.damage).toEqual({ dice: '1d6+3', types: ['piercing'] });
    expect(def.save).toEqual({ ability: 'con', half: false });
    expect(def.effects?.[0]).toMatchObject({ to: 'targets', conditions: ['poisoned'] });
  });

  it('сейв без атаки: половина урона при успехе', () => {
    const action = makeAction({
      ability: {
        save: { ability: 'dex' },
        damage: { dice: '2d6', types: ['fire'] },
      },
    });
    const def = monsterAbilityAutomation(action)!;
    expect(def.resolution).toBe('save');
    expect(def.save).toEqual({ ability: 'dex', half: true });
  });

  it('untilSave-эффект берёт характеристику из сейва способности', () => {
    const action = makeAction({
      ability: {
        save: { ability: 'wis' },
        effects: [{ condition: 'paralyzed', duration: { type: 'untilSave', ability: 'con', dc: 0, timing: 'end' } }],
      },
    });
    const effect = monsterAbilityAutomation(action)!.effects![0]!;
    expect(effect.duration).toEqual({ type: 'untilSave', ability: 'wis', dc: 0, timing: 'end' });
  });

  it('без сейва и атаки — auto с эффектами', () => {
    const action = makeAction({
      ability: {
        damage: { dice: '1d4', types: ['force'] },
        effects: [{ condition: 'prone', duration: { type: 'endOfTurn', of: 'target' } }],
      },
    });
    const def = monsterAbilityAutomation(action)!;
    expect(def.resolution).toBe('auto');
    expect(def.effects).toHaveLength(1);
    expect(monsterAbilityAutomation(makeAction())).toBeUndefined();
  });

  it('дистанция по умолчанию: ближняя атака 5, прочее 30', () => {
    const melee = makeAction({
      ability: { targeting: { kind: 'creature' }, attack: { rangeType: 'melee' } },
    });
    expect(monsterAbilityAutomation(melee)!.targeting?.range).toBe(5);
    const ranged = makeAction({
      ability: { targeting: { kind: 'creature' }, attack: { rangeType: 'ranged' } },
    });
    expect(monsterAbilityAutomation(ranged)!.targeting?.range).toBe(30);
    const save = makeAction({ ability: { targeting: { kind: 'area', area: { shape: 'sphere', size: 20 } } } });
    expect(monsterAbilityAutomation(save)!.targeting?.range).toBe(30);
  });
});

describe('monsterStats', () => {
  it('дефолты +3 и 10 без статблока', () => {
    expect(monsterStats(undefined, undefined)).toMatchObject({ attack: 3, dc: 10 });
  });

  it('статблок и способность переопределяют', () => {
    const statblock: TokenStatblock = { abilities: { ...DEFAULT_ABILITIES }, attackBonus: '+7', saveDc: 15 };
    expect(monsterStats(statblock, {})).toMatchObject({ attack: 7, dc: 15 });
    expect(monsterStats(statblock, { attack: { rangeType: 'ranged', bonus: '-1' }, dc: 20 })).toMatchObject({
      attack: -1,
      dc: 20,
    });
  });
});

describe('легендарные способности', () => {
  it('legendaryOnly и минимальная стоимость', () => {
    const roar = makeAction({ id: 'r', costs: [], legendaryCost: 2 });
    const tail = makeAction({ id: 't', costs: ['action'], legendaryCost: 1 });
    expect(legendaryOnly(roar)).toBe(true);
    expect(legendaryOnly(tail)).toBe(false);
    expect(minLegendaryCost([roar, tail])).toBe(2);
    expect(minLegendaryCost([])).toBe(Infinity);
  });
});
