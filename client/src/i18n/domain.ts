import {
  CONDITION_DESCRIPTIONS,
  type AbilityKey,
  type ConditionKey,
  type DamageDefenseType,
  type LightAreaKind,
  type SenseType,
} from 'shared';
import { t, type MessageKey } from './index';

function fromCatalog(key: string): string | undefined {
  const text = t(key as MessageKey);
  return text === key ? undefined : text;
}

function label(key: string, value: string, fallback?: string): string {
  return fromCatalog(key) ?? fallback ?? value;
}

export function abilityName(key: AbilityKey): string {
  return t(`domain.ability.${key}` as MessageKey);
}

export function skillName(key: string): string {
  return t(`domain.skill.${key}` as MessageKey);
}

export function damageLabel(key: string): string {
  return t(`domain.damage.${key}` as MessageKey);
}

export function defenseLabel(key: DamageDefenseType): string {
  return t(`domain.defense.${key}` as MessageKey);
}

export function senseLabel(key: SenseType): string {
  return t(`domain.sense.${key}` as MessageKey);
}

export function lightAreaLabel(key: LightAreaKind): string {
  return t(`domain.lightArea.${key}` as MessageKey);
}

export function conditionLabel(key: string, fallback?: string): string {
  if (key === 'custom') return fallback?.trim() ? fallback : label(`domain.condition.${key}`, key);
  return label(`domain.condition.${key}`, key, fallback);
}

export function conditionHint(key: string): string {
  return fromCatalog(`domain.conditionHint.${key}`) ?? CONDITION_DESCRIPTIONS[key as ConditionKey] ?? key;
}

export function classLabel(key: string, fallback?: string): string {
  return label(`domain.class.${key}`, key, fallback);
}

export function subclassLabel(classKey: string, subKey: string, fallback?: string): string {
  return label(`domain.subclass.${classKey}.${subKey}`, `${classKey}.${subKey}`, fallback);
}

export function resourceLabel(key: string | null | undefined, fallback?: string): string {
  if (!key) return fallback ?? '';
  return label(`domain.resource.${key}`, key, fallback);
}

export function baseActionLabel(id: string, fallback?: string): string {
  return label(`domain.baseAction.${id}`, id, fallback);
}

export function reactionLabel(id: string, fallback?: string): string {
  return label(`domain.reaction.${id}`, id, fallback);
}
