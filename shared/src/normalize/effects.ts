import { MAX_CONDITIONS, MAX_EFFECTS, MAX_MODIFIERS } from '../domain/core';
import type {
  ConditionInstance,
  ConditionKey,
  EffectDuration,
  EffectInstance,
  EffectTurnPayload,
  Modifier,
  ModifierFilter,
  ModifierMode,
  ModifierTarget,
} from '../domain/effects';
import { clampInt, isAbilityKey, newId } from './internal';
import { normalizeSenses } from './sense';
import type { LightSource } from '../domain/automation';
import { CONDITION_KEYS } from '../rules/conditions';

const MODIFIER_TARGETS: ModifierTarget[] = [
  'attack',
  'damage',
  'ac',
  'save',
  'check',
  'speed',
  'initiative',
  'maxHp',
  'spellDc',
  'spellAttack',
  'extraActions',
  'extraBonusActions',
  'reach',
];
const MODIFIER_MODES: ModifierMode[] = [
  'add',
  'multiply',
  'set',
  'advantage',
  'disadvantage',
  'resistance',
  'immunity',
  'vulnerability',
];

function normalizeModifierFilter(raw: unknown): ModifierFilter | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const f = raw as Record<string, unknown>;
  const out: ModifierFilter = {};
  if (f.attackType === 'melee' || f.attackType === 'ranged') out.attackType = f.attackType;
  if (isAbilityKey(f.ability)) out.ability = f.ability;
  if (typeof f.skill === 'string') out.skill = f.skill.slice(0, 40);
  if (typeof f.damageType === 'string') out.damageType = f.damageType.slice(0, 40);
  if (f.rangeType === 'melee' || f.rangeType === 'ranged' || f.rangeType === 'none') out.rangeType = f.rangeType;
  if (typeof f.targetId === 'string' && f.targetId) out.targetId = f.targetId.slice(0, 80);
  if (f.direction === 'self' || f.direction === 'against') out.direction = f.direction;
  if (typeof f.weapon === 'boolean') out.weapon = f.weapon;
  return Object.keys(out).length ? out : undefined;
}

function normalizeModifier(raw: unknown): Modifier | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Partial<Modifier>;
  if (!MODIFIER_TARGETS.includes(m.target as ModifierTarget)) return null;
  if (!MODIFIER_MODES.includes(m.mode as ModifierMode)) return null;
  const value = typeof m.value === 'string' ? m.value.slice(0, 40) : clampInt(m.value, -9999, 9999, 0);
  return {
    id: typeof m.id === 'string' && m.id ? m.id : newId(),
    target: m.target as ModifierTarget,
    mode: m.mode as ModifierMode,
    value,
    filter: normalizeModifierFilter(m.filter),
  };
}

export function normalizeEffectDuration(raw: unknown): EffectDuration | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  if (d.type === 'rounds') return { type: 'rounds', rounds: clampInt(d.rounds, 0, 9999, 0) };
  if (d.type === 'untilSave') {
    if (!isAbilityKey(d.ability)) return null;
    return { type: 'untilSave', ability: d.ability, dc: clampInt(d.dc, 0, 40, 0), timing: d.timing === 'start' ? 'start' : 'end' };
  }
  if (d.type === 'endOfTurn') return { type: 'endOfTurn', of: d.of === 'target' ? 'target' : 'source' };
  if (d.type === 'concentration') return { type: 'concentration' };
  if (d.type === 'permanent') return { type: 'permanent' };
  return null;
}

export function normalizeConditions(raw: unknown): ConditionInstance[] {
  if (!Array.isArray(raw)) return [];
  const out: ConditionInstance[] = [];
  for (const item of raw.slice(0, MAX_CONDITIONS)) {
    if (!item || typeof item !== 'object') continue;
    const c = item as Partial<ConditionInstance>;
    const key = typeof c.key === 'string' && c.key ? c.key : 'custom';
    const condition: ConditionInstance = {
      key: key as ConditionKey,
      name: typeof c.name === 'string' && c.name.trim() ? c.name.trim().slice(0, 40) : key,
      rounds: c.rounds === undefined || c.rounds === null ? null : clampInt(c.rounds, 0, 9999, 0),
    };
    if (c.key === 'exhaustion') condition.level = clampInt(c.level, 1, 6, 1);
    if (typeof c.sourceId === 'string' && c.sourceId) condition.sourceId = c.sourceId;
    if (typeof c.sourceKey === 'string' && c.sourceKey) condition.sourceKey = c.sourceKey.slice(0, 80);
    if (typeof c.effectId === 'string' && c.effectId) condition.effectId = c.effectId.slice(0, 80);
    if (c.save && typeof c.save === 'object' && isAbilityKey(c.save.ability)) {
      condition.save = {
        ability: c.save.ability,
        dc: clampInt(c.save.dc, 0, 40, 0),
        timing: c.save.timing === 'start' ? 'start' : 'end',
      };
    }
    out.push(condition);
  }
  return out;
}

export function normalizeEffects(raw: unknown): EffectInstance[] {
  if (!Array.isArray(raw)) return [];
  const out: EffectInstance[] = [];
  for (const item of raw.slice(0, MAX_EFFECTS)) {
    if (!item || typeof item !== 'object') continue;
    const e = item as Partial<EffectInstance>;
    const duration = normalizeEffectDuration(e.duration);
    if (!duration) continue;
    const modifiers = (Array.isArray(e.modifiers) ? e.modifiers : [])
      .map(normalizeModifier)
      .filter((m): m is Modifier => m !== null)
      .slice(0, MAX_MODIFIERS);
    const effect: EffectInstance = {
      id: typeof e.id === 'string' && e.id ? e.id : newId(),
      name: typeof e.name === 'string' && e.name.trim() ? e.name.trim().slice(0, 60) : 'Эффект',
      duration,
      modifiers,
    };
    if (typeof e.sourceKey === 'string' && e.sourceKey) effect.sourceKey = e.sourceKey;
    if (typeof e.sourceId === 'string' && e.sourceId) effect.sourceId = e.sourceId;
    if (e.concentration === true) effect.concentration = true;
    if (e.hidden === true) effect.hidden = true;
    if (e.consumeOnAttackRoll === true) effect.consumeOnAttackRoll = true;
    if (e.deathWard === true) effect.deathWard = true;
    if (e.immuneToSpeedReduction === true) effect.immuneToSpeedReduction = true;
    if (e.ignoresDifficultTerrain === true) effect.ignoresDifficultTerrain = true;
    if (Array.isArray(e.conditionImmunities)) {
      const immune = e.conditionImmunities
        .filter((k): k is ConditionKey => typeof k === 'string' && (CONDITION_KEYS as string[]).includes(k))
        .slice(0, 10);
      if (immune.length) effect.conditionImmunities = [...new Set(immune)];
    }
    const startTrigger = (e.triggers as { startOfTurn?: unknown } | undefined)?.startOfTurn;
    if (startTrigger && typeof startTrigger === 'object') {
      const raw = startTrigger as { tempHp?: unknown; damage?: { dice?: unknown; types?: unknown } };
      const payload: EffectTurnPayload = {};
      const tempHp = clampInt(raw.tempHp, 0, 999, 0);
      if (tempHp > 0) payload.tempHp = tempHp;
      if (raw.damage && typeof raw.damage === 'object' && typeof raw.damage.dice === 'string' && raw.damage.dice.trim()) {
        payload.damage = {
          dice: raw.damage.dice.trim().slice(0, 40),
          ...(Array.isArray(raw.damage.types)
            ? { types: raw.damage.types.filter((t): t is string => typeof t === 'string').slice(0, 4) }
            : {}),
        };
      }
      if (payload.tempHp || payload.damage) effect.triggers = { startOfTurn: payload };
    }
    if (typeof e.variant === 'string' && e.variant) effect.variant = e.variant.slice(0, 40);
    if (e.mark === true) effect.mark = true;
    if (e.light && typeof e.light === 'object') {
      const l = e.light as Partial<LightSource>;
      effect.light = {
        bright: clampInt(l.bright, 0, 1000, 0),
        dim: clampInt(l.dim, 0, 1000, 0),
        ...(l.sunlight === true ? { sunlight: true } : {}),
      };
    }
    if (Array.isArray(e.conditions)) {
      const conditions = e.conditions.filter((c): c is ConditionKey => typeof c === 'string');
      if (conditions.length) effect.conditions = conditions.slice(0, MAX_CONDITIONS);
    }
    if (Array.isArray(e.senses)) {
      const senses = normalizeSenses(e.senses);
      if (senses.length) effect.senses = senses;
    }
    out.push(effect);
  }
  return out;
}
