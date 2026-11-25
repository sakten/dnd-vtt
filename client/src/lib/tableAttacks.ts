import {
  BASE_ACTIONS,
  loadoutOf,
  weaponContextOf,
  type AttackEntry,
  type AttackRangeType,
  type CharacterSheet,
  type Token,
} from 'shared';
import type { TargetingState } from '../domain/interaction';

/** Атаки актора для подписей прицеливания: лист контролёра или сам токен (производный лоадаут). */
export function attacksOf(
  attacker: Token,
  sheet: CharacterSheet | null | undefined,
  currentCharacterId: string | null
): AttackEntry[] {
  const fromSheet =
    currentCharacterId !== null && attacker.libraryItemId === currentCharacterId && sheet ? sheet : undefined;
  return loadoutOf({
    attacks: fromSheet ? fromSheet.attacks : attacker.attacks,
    hands: fromSheet?.hands,
    effects: attacker.effects,
    ...weaponContextOf(fromSheet),
  }).attacks;
}

/** Тип дистанции выбранной атаки: оружие/безоружный удар/способность-атака; null — не атака. */
export function attackRangeTypeOf(
  targeting: TargetingState,
  attacker: Token,
  sheet: CharacterSheet | null | undefined,
  currentCharacterId: string | null
): AttackRangeType | null {
  const index = 'attackIndex' in targeting ? targeting.attackIndex : undefined;
  if (index !== undefined) {
    const attacks = attacksOf(attacker, sheet, currentCharacterId);
    return attacks[index]?.rangeType ?? null;
  }
  if (targeting.kind !== 'action') return null;
  const action =
    attacker.statblock?.actions?.find((a) => a.id === targeting.actionId) ??
    BASE_ACTIONS.find((a) => a.id === targeting.actionId);
  if (action?.ability?.attack) return action.ability.attack.rangeType;
  return action?.id === 'unarmedStrike' ? 'melee' : null;
}

/** Запись атаки выбранного оружия/способности-атаки (для свойств и дистанции); null — нет. */
export function attackEntryOf(
  targeting: TargetingState,
  attacker: Token,
  sheet: CharacterSheet | null | undefined,
  currentCharacterId: string | null
): AttackEntry | null {
  const index = 'attackIndex' in targeting ? targeting.attackIndex : undefined;
  if (index === undefined) return null;
  return attacksOf(attacker, sheet, currentCharacterId)[index] ?? null;
}
