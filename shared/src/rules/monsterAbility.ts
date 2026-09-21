import { actionTargeting, type ActionDef, type MonsterAbilityDef } from '../domain/actions';
import type { AutomationDef, AutomationEffect, AutomationResolution } from '../domain/automation';
import type { TokenStatblock } from '../domain/token';
import type { SpellStats } from './spellCast';

export function legendaryOnly(action: ActionDef): boolean {
  return !!action.legendaryCost && action.costs.length === 0;
}

export function minLegendaryCost(actions: ActionDef[] | undefined): number {
  let min = Infinity;
  for (const action of actions ?? []) {
    if (!legendaryOnly(action)) continue;
    min = Math.min(min, action.legendaryCost ?? 1);
  }
  return min;
}

export function monsterAbilityAutomation(action: ActionDef): AutomationDef | undefined {
  const ability = action.ability;
  if (!ability) return undefined;
  const resolution: AutomationResolution = ability.attack ? 'attack' : ability.save ? 'save' : 'auto';
  const def: AutomationDef = { key: `statblock:${action.id}`, name: action.name, resolution };
  const targeting = actionTargeting(action);
  if (targeting) {
    def.targeting = {
      ...targeting,
      range: targeting.range ?? (ability.attack?.rangeType === 'melee' ? 5 : 30),
    };
  }
  if (ability.attack) {
    def.attack = { rangeType: ability.attack.rangeType };
    if (ability.attack.damage) def.damage = { dice: ability.attack.damage, types: ability.attack.types };
    const targets = targeting?.targets ?? 1;
    if (targets > 1) def.count = targets;
  } else if (ability.damage) {
    def.damage = { dice: ability.damage.dice, types: ability.damage.types };
  }
  if (ability.save) def.save = { ability: ability.save.ability, half: !ability.attack && !!ability.damage };
  if (ability.effects?.length) {
    def.effects = ability.effects.map(
      (e): AutomationEffect => ({
        name: action.name,
        duration:
          e.duration.type === 'untilSave' && ability.save
            ? { ...e.duration, ability: ability.save.ability }
            : e.duration,
        to: 'targets',
        modifiers: [],
        conditions: [e.condition],
      })
    );
  }
  return def;
}

export function monsterStats(statblock: TokenStatblock | undefined, ability: MonsterAbilityDef | undefined): SpellStats {
  const bonusText = (ability?.attack?.bonus ?? statblock?.attackBonus ?? '').trim();
  const parsed = bonusText ? Number(bonusText) : Number.NaN;
  return {
    ability: statblock?.spellcasting?.ability ?? 'str',
    mod: 0,
    dc: ability?.dc ?? statblock?.saveDc ?? 10,
    attack: Number.isFinite(parsed) ? parsed : 3,
  };
}
