import {
  SKILLS,
  abilityMod,
  bonusPart,
  checkRollParts,
  d20Check,
  fmtMod,
  normalizeSheet,
  type AbilityKey,
  type CharacterSheet,
  type RollParts,
  type Token,
} from 'shared';

export { bonusPart };

/** Новый лист: те же дефолты, что и у гидратированного (один источник — `normalizeSheet`). */
export function defaultSheet(): CharacterSheet {
  return normalizeSheet({});
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

/** Части проверки от эффектов токена персонажа (Enhance Ability и подобные). */
export function checkEffectParts(
  token: Token | null | undefined,
  sheet: CharacterSheet,
  ctx: { ability?: AbilityKey; skill?: string }
): RollParts {
  return checkRollParts(token?.effects, ctx, sheet.abilities);
}
