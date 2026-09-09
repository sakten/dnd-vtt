import { ABILITIES, SKILLS, abilityMod, type AbilityKey, type CharacterSheet, type SkillLevel } from 'shared';

export function defaultSheet(): CharacterSheet {
  return {
    name: '',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    proficiencyBonus: '2',
    saves: {},
    skills: {},
    attack: { name: '', hit: 'd20', damage: 'd6' },
  };
}

function fmtMod(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function bonusPart(pb: string, level: SkillLevel | 0): string {
  if (level === 0) return '';
  const trimmed = pb.trim();
  if (!trimmed) return '';
  if (level === 1) return `+${trimmed}`;
  const num = trimmed.match(/^(\d+)$/);
  if (num) return `+${Number(num[1]) * 2}`;
  const die = trimmed.match(/^(\d*)d(\d+)$/i);
  if (die) {
    const count = die[1] ? Number(die[1]) : 1;
    return `+${count * 2}d${die[2]}`;
  }
  return `+${trimmed}`;
}

export function saveExpression(sheet: CharacterSheet, ability: AbilityKey): string {
  const mod = abilityMod(sheet.abilities[ability] ?? 10);
  const prof = sheet.saves[ability] ? 1 : 0;
  return `d20${fmtMod(mod)}${bonusPart(sheet.proficiencyBonus, prof)}`;
}

export function checkExpression(sheet: CharacterSheet, skillKey: string): string {
  const skill = SKILLS.find((s) => s.key === skillKey);
  if (!skill) return 'd20';
  const mod = abilityMod(sheet.abilities[skill.ability] ?? 10);
  const level = sheet.skills[skillKey] ?? 0;
  return `d20${fmtMod(mod)}${bonusPart(sheet.proficiencyBonus, level)}`;
}

export function attackRolls(sheet: CharacterSheet): { expression: string; label: string }[] {
  const name = sheet.attack.name.trim() || 'Атака';
  const rolls: { expression: string; label: string }[] = [];
  const hit = sheet.attack.hit.trim();
  if (hit) rolls.push({ expression: hit, label: `Атака: ${name}` });
  const damage = sheet.attack.damage.trim();
  if (damage) rolls.push({ expression: damage, label: `Урон: ${name}` });
  return rolls;
}

export function skillPreview(sheet: CharacterSheet, skillKey: string): string {
  const skill = SKILLS.find((s) => s.key === skillKey);
  if (!skill) return '';
  const mod = abilityMod(sheet.abilities[skill.ability] ?? 10);
  const level = sheet.skills[skillKey] ?? 0;
  return `${fmtMod(mod)}${bonusPart(sheet.proficiencyBonus, level)}`;
}

export function abilityName(key: AbilityKey): string {
  return ABILITIES.find((a) => a.key === key)?.name ?? key;
}
