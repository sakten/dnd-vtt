import { DEFAULT_ABILITIES, type AbilityKey } from '../domain/core';
import type {
  ActionCost,
  ActionDef,
  ActionTargeting,
  MonsterAbilityAttack,
  MonsterAbilityDef,
  MonsterAbilityEffect,
} from '../domain/actions';
import type { ConditionKey } from '../domain/effects';
import type { TokenStatblock } from '../domain/token';
import { parseDiceExpression } from '../dice';
import { DAMAGE_TYPES } from '../labels';
import { CONDITION_KEYS } from '../rules/conditions';
import { normalizeEffectDuration } from './effects';
import { SPELL_KEY_RE, clampInt, isAbilityKey, newId } from './internal';

const ACTION_COSTS: ActionCost[] = ['action', 'bonus', 'reaction', 'free', 'movement', 'legendary', 'lair', 'special'];
const ACTION_SOURCES: ActionDef['source'][] = ['basic', 'class', 'subclass', 'spell', 'monster'];
const ATTACK_BONUS_RE = /^[+-]?\d{1,2}$/;
const DAMAGE_KEYS = new Set(DAMAGE_TYPES.map((d) => d.key));

function validDice(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const expr = raw.trim().slice(0, 40);
  if (!expr) return undefined;
  try {
    parseDiceExpression(expr);
    return expr;
  } catch {
    return undefined;
  }
}

function normalizeDamageTypes(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out = [...new Set(raw.filter((t): t is string => typeof t === 'string' && DAMAGE_KEYS.has(t)))].slice(0, 4);
  return out.length ? out : undefined;
}

function normalizeAbility(raw: unknown): MonsterAbilityDef | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const a = raw as Partial<MonsterAbilityDef>;
  const out: MonsterAbilityDef = {};
  if (a.attack && typeof a.attack === 'object') {
    const at = a.attack as Partial<MonsterAbilityAttack>;
    if (at.rangeType === 'melee' || at.rangeType === 'ranged') {
      const attack: MonsterAbilityAttack = { rangeType: at.rangeType };
      const bonus = typeof at.bonus === 'string' ? at.bonus.trim() : '';
      if (ATTACK_BONUS_RE.test(bonus)) attack.bonus = bonus;
      const damage = validDice(at.damage);
      if (damage) attack.damage = damage;
      const types = normalizeDamageTypes(at.types);
      if (types) attack.types = types;
      out.attack = attack;
    }
  }
  if (a.save && typeof a.save === 'object' && isAbilityKey(a.save.ability)) out.save = { ability: a.save.ability };
  if (typeof a.dc === 'number' && a.dc >= 1) out.dc = clampInt(a.dc, 1, 40, 10);
  if (a.damage && typeof a.damage === 'object') {
    const dice = validDice(a.damage.dice);
    if (dice) {
      const damage: { dice: string; types?: string[] } = { dice };
      const types = normalizeDamageTypes(a.damage.types);
      if (types) damage.types = types;
      out.damage = damage;
    }
  }
  if (Array.isArray(a.effects)) {
    const effects: MonsterAbilityEffect[] = [];
    for (const item of a.effects.slice(0, 6)) {
      if (!item || typeof item !== 'object') continue;
      const e = item as { condition?: unknown; duration?: unknown };
      if (typeof e.condition !== 'string' || !CONDITION_KEYS.includes(e.condition as ConditionKey)) continue;
      const duration = normalizeEffectDuration(e.duration);
      if (!duration) continue;
      effects.push({ condition: e.condition as ConditionKey, duration });
    }
    if (effects.length) out.effects = effects;
  }
  return Object.keys(out).length ? out : undefined;
}

function normalizeTargeting(raw: unknown): ActionTargeting | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const t = raw as Partial<ActionTargeting>;
  if (t.kind !== 'self' && t.kind !== 'creature' && t.kind !== 'point' && t.kind !== 'area') return undefined;
  const out: ActionTargeting = { kind: t.kind };
  if (typeof t.range === 'number') out.range = clampInt(t.range, 0, 10000, 0);
  if (typeof t.targets === 'number') out.targets = clampInt(t.targets, 1, 50, 1);
  if (t.area && typeof t.area === 'object') {
    const shape = t.area.shape;
    if (shape === 'sphere' || shape === 'cone' || shape === 'cube' || shape === 'line' || shape === 'cylinder') {
      out.area = { shape, size: clampInt(t.area.size, 0, 10000, 0) };
      if (typeof t.area.width === 'number') out.area.width = clampInt(t.area.width, 0, 1000, 0);
    }
  }
  return out;
}

export function normalizeActions(raw: unknown): ActionDef[] {
  if (!Array.isArray(raw)) return [];
  const out: ActionDef[] = [];
  for (const item of raw.slice(0, 50)) {
    if (!item || typeof item !== 'object') continue;
    const a = item as Partial<ActionDef> & { cost?: unknown };
    if (typeof a.name !== 'string' || !a.name.trim()) continue;
    const rawCosts = Array.isArray(a.costs) ? a.costs : a.cost !== undefined ? [a.cost] : [];
    const costs = [...new Set(rawCosts.filter((c): c is ActionCost => ACTION_COSTS.includes(c as ActionCost)))];
    const legendaryCost =
      typeof a.legendaryCost === 'number' && a.legendaryCost >= 1 ? clampInt(a.legendaryCost, 1, 3, 1) : 0;
    if (costs.length === 0 && !legendaryCost) costs.push('action');
    const action: ActionDef = {
      id: typeof a.id === 'string' && a.id ? a.id : newId(),
      name: a.name.trim().slice(0, 60),
      source: ACTION_SOURCES.includes(a.source as ActionDef['source']) ? (a.source as ActionDef['source']) : 'monster',
      costs,
    };
    if (typeof a.levelReq === 'number') action.levelReq = clampInt(a.levelReq, 0, 30, 0);
    if (typeof a.resourceKey === 'string' && a.resourceKey) action.resourceKey = a.resourceKey;
    if (typeof a.resourceAmount === 'number') action.resourceAmount = clampInt(a.resourceAmount, 0, 99, 0);
    if (typeof a.description === 'string') action.description = a.description.slice(0, 400);
    const targeting = normalizeTargeting(a.targeting);
    if (targeting) action.targeting = targeting;
    if (legendaryCost) action.legendaryCost = legendaryCost;
    if (typeof a.recharge === 'number' && a.recharge >= 1) {
      action.recharge = clampInt(a.recharge, 1, 20, 1);
    }
    if (typeof a.spellKey === 'string' && a.spellKey.length <= 100 && SPELL_KEY_RE.test(a.spellKey)) {
      action.spellKey = a.spellKey;
    }
    const ability = normalizeAbility(a.ability);
    if (ability && Object.keys(ability).length) action.ability = ability;
    if (typeof a.libraryId === 'string' && a.libraryId) action.libraryId = a.libraryId.slice(0, 100);
    out.push(action);
  }
  return out;
}

export function normalizeStatblock(raw: unknown): TokenStatblock | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const s = raw as Partial<TokenStatblock>;
  const abilities = { ...DEFAULT_ABILITIES };
  if (s.abilities && typeof s.abilities === 'object') {
    const source = s.abilities as Record<string, unknown>;
    for (const key of Object.keys(DEFAULT_ABILITIES) as AbilityKey[]) {
      const n = Number(source[key]);
      if (Number.isFinite(n)) abilities[key] = Math.min(30, Math.max(0, Math.round(n)));
    }
  }
  const saves: Partial<Record<AbilityKey, number>> = {};
  if (s.saves && typeof s.saves === 'object') {
    const source = s.saves as Record<string, unknown>;
    for (const key of Object.keys(DEFAULT_ABILITIES) as AbilityKey[]) {
      const n = Number(source[key]);
      if (Number.isFinite(n)) saves[key] = Math.round(n);
    }
  }
  const statblock: TokenStatblock = { abilities };
  if (Object.keys(saves).length) statblock.saves = saves;
  if (typeof s.attackBonus === 'string' && ATTACK_BONUS_RE.test(s.attackBonus.trim())) {
    statblock.attackBonus = s.attackBonus.trim();
  }
  if (typeof s.saveDc === 'number' && s.saveDc >= 1) {
    statblock.saveDc = clampInt(s.saveDc, 1, 40, 10);
  }
  if (s.spellcasting && typeof s.spellcasting === 'object' && isAbilityKey(s.spellcasting.ability)) {
    const sc: NonNullable<TokenStatblock['spellcasting']> = { ability: s.spellcasting.ability };
    if (typeof s.spellcasting.dc === 'number') sc.dc = clampInt(s.spellcasting.dc, 0, 40, 0);
    if (typeof s.spellcasting.attack === 'number') sc.attack = clampInt(s.spellcasting.attack, 0, 40, 0);
    if (Array.isArray(s.spellcasting.slots)) {
      const slots: { level: number; max: number; current: number }[] = [];
      const seenLevels = new Set<number>();
      for (const raw of s.spellcasting.slots) {
        if (!raw || typeof raw !== 'object') continue;
        const item = raw as { level?: unknown; max?: unknown; current?: unknown };
        const level = clampInt(Number(item.level), 1, 9, 0);
        const max = clampInt(Number(item.max), 0, 99, 0);
        if (!level || max <= 0 || seenLevels.has(level)) continue;
        seenLevels.add(level);
        slots.push({ level, max, current: clampInt(Number(item.current), 0, max, max) });
      }
      slots.sort((a, b) => a.level - b.level);
      if (slots.length) sc.slots = slots;
    }
    if (Array.isArray(s.spellcasting.spells)) {
      const keys: string[] = [];
      const seenKeys = new Set<string>();
      for (const key of s.spellcasting.spells) {
        if (typeof key !== 'string' || key.length > 100 || !SPELL_KEY_RE.test(key) || seenKeys.has(key)) continue;
        seenKeys.add(key);
        if (keys.length < 200) keys.push(key);
      }
      sc.spells = keys;
    }
    statblock.spellcasting = sc;
  }
  const actions = normalizeActions(s.actions);
  if (actions.length) statblock.actions = actions;
  if (typeof s.multiattack === 'number') statblock.multiattack = clampInt(s.multiattack, 1, 10, 1);
  if (s.legendary && typeof s.legendary === 'object') {
    const legendaryActions = normalizeActions(s.legendary.actions);
    const max = clampInt(s.legendary.max, 0, 9, 0);
    if (max > 0 || legendaryActions.length) statblock.legendary = { max, actions: legendaryActions };
  }
  return statblock;
}
