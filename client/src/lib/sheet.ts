import {
  DEFAULT_ABILITIES,
  DEFAULT_SPEED,
  SKILLS,
  abilityMod,
  bonusPart,
  d20Check,
  emptyAttack,
  fmtMod,
  type AbilityKey,
  type CharacterSheet,
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

export function saveExpression(sheet: CharacterSheet, ability: AbilityKey): string {
  const mod = abilityMod(sheet.abilities[ability] ?? 10);
  return d20Check(mod, sheet.proficiencyBonus, sheet.saves[ability] ? 1 : 0);
}

export function checkExpression(sheet: CharacterSheet, skillKey: string): string {
  const skill = SKILLS.find((s) => s.key === skillKey);
  if (!skill) return 'd20';
  const mod = abilityMod(sheet.abilities[skill.ability] ?? 10);
  return d20Check(mod, sheet.proficiencyBonus, sheet.skills[skillKey] ?? 0);
}

export function skillPreview(sheet: CharacterSheet, skillKey: string): string {
  const skill = SKILLS.find((s) => s.key === skillKey);
  if (!skill) return '';
  const mod = abilityMod(sheet.abilities[skill.ability] ?? 10);
  const level = sheet.skills[skillKey] ?? 0;
  return `${fmtMod(mod)}${bonusPart(sheet.proficiencyBonus, level)}`;
}
