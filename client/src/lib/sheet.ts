import {
  DEFAULT_ABILITIES,
  DEFAULT_SPEED,
  SKILLS,
  abilityMod,
  bonusPart,
  emptyAttack,
  type AbilityKey,
  type CharacterSheet,
  type SkillLevel,
} from 'shared';

export { bonusPart };

export function defaultSheet(): CharacterSheet {
  return {
    name: '',
    abilities: { ...DEFAULT_ABILITIES },
    proficiencyBonus: '2',
    saves: {},
    skills: {},
    attacks: [{ ...emptyAttack(), hit: 'd20', damage: 'd6' }],
    classes: [],
    spells: [],
    hpMax: '',
    ac: '',
    speed: DEFAULT_SPEED,
    senses: [],
    damageDefenses: [],
  };
}

function fmtMod(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

function modExpr(mod: number, pb: string, level: SkillLevel | 0): string {
  return `${fmtMod(mod)}${bonusPart(pb, level)}`;
}

function d20Expr(mod: number, pb: string, level: SkillLevel | 0): string {
  return `d20${modExpr(mod, pb, level)}`;
}

export function saveExpression(sheet: CharacterSheet, ability: AbilityKey): string {
  const mod = abilityMod(sheet.abilities[ability] ?? 10);
  const prof = sheet.saves[ability] ? 1 : 0;
  return d20Expr(mod, sheet.proficiencyBonus, prof);
}

export function checkExpression(sheet: CharacterSheet, skillKey: string): string {
  const skill = SKILLS.find((s) => s.key === skillKey);
  if (!skill) return 'd20';
  const mod = abilityMod(sheet.abilities[skill.ability] ?? 10);
  const level = sheet.skills[skillKey] ?? 0;
  return d20Expr(mod, sheet.proficiencyBonus, level);
}

export function skillPreview(sheet: CharacterSheet, skillKey: string): string {
  const skill = SKILLS.find((s) => s.key === skillKey);
  if (!skill) return '';
  const mod = abilityMod(sheet.abilities[skill.ability] ?? 10);
  const level = sheet.skills[skillKey] ?? 0;
  return modExpr(mod, sheet.proficiencyBonus, level);
}
