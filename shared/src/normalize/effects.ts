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
  Restrictions,
} from '../domain/effects';
import { clampInt, isAbilityKey, newId } from './internal';
import { normalizeSenses } from './sense';
import type { GrantedAction, LightSource } from '../domain/automation';
import { CONDITION_KEYS } from '../rules/conditions';
import { CREATURE_TYPES } from '../labels';

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

/** Булевы ограничения экономики, переносимые из `restrictions` как есть. */
const RESTRICTION_KEYS = [
  'noActions',
  'noBonus',
  'noActionsFromEffect',
  'noReactions',
  'noOpportunityAttacks',
  'ignoresOpportunityAttacks',
  'oneAttackOnly',
  'actionOrBonusOnly',
  'noSpells',
] as const;

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
  if (typeof f.unarmed === 'boolean') out.unarmed = f.unarmed;
  // Легаси `condition` (одиночный) приводим к `conditions`: оба — «совпадение с любым».
  const rawConditions = [
    ...(typeof f.condition === 'string' ? [f.condition] : []),
    ...(Array.isArray(f.conditions) ? f.conditions : []),
  ];
  const conditions = rawConditions.filter(
    (c): c is ConditionKey => typeof c === 'string' && (CONDITION_KEYS as string[]).includes(c)
  );
  if (conditions.length) out.conditions = [...new Set(conditions)];
  if (typeof f.magical === 'boolean') out.magical = f.magical;
  if (Array.isArray(f.creatureTypes)) {
    const types = f.creatureTypes.filter(
      (t): t is string => typeof t === 'string' && CREATURE_TYPES.some((c) => c.key === t)
    );
    if (types.length) out.creatureTypes = [...new Set(types)];
  }
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
    if (typeof e.maxRounds === 'number' && Number.isFinite(e.maxRounds)) {
      effect.maxRounds = clampInt(e.maxRounds, 1, 9999, 10);
    }
    if (e.hidden === true) effect.hidden = true;
    if (e.consumeOnAttackRoll === true) effect.consumeOnAttackRoll = true;
    if (e.deathWard === true) effect.deathWard = true;
    if (e.magicWeapon === true) effect.magicWeapon = true;
    if (e.weaponOverride && typeof e.weaponOverride === 'object') {
      const o = e.weaponOverride as { weapons?: unknown; dice?: unknown; damageType?: unknown; abilityMod?: unknown };
      const weapons = Array.isArray(o.weapons)
        ? o.weapons.filter((w): w is string => typeof w === 'string' && !!w).slice(0, 8)
        : [];
      if (
        weapons.length &&
        typeof o.dice === 'string' &&
        o.dice.trim() &&
        typeof o.damageType === 'string' &&
        o.damageType
      ) {
        effect.weaponOverride = {
          weapons: [...new Set(weapons)],
          dice: o.dice.trim().slice(0, 40),
          damageType: o.damageType.slice(0, 40),
          abilityMod: clampInt(o.abilityMod, -30, 30, 0),
        };
      }
    }
    if (e.saveMarker === true) effect.saveMarker = true;
    if (e.damageLink && typeof e.damageLink === 'object') {
      const link = e.damageLink as { tokenId?: unknown };
      if (typeof link.tokenId === 'string' && link.tokenId) effect.damageLink = { tokenId: link.tokenId.slice(0, 64) };
    }
    if (e.immuneToSpeedReduction === true) effect.immuneToSpeedReduction = true;
    if (e.ignoresDifficultTerrain === true) effect.ignoresDifficultTerrain = true;
    if (e.seesInvisible === true) effect.seesInvisible = true;
    if (e.maximizeHealing === true) effect.maximizeHealing = true;
    if (e.deathSaveAdvantage === true) effect.deathSaveAdvantage = true;
    if (e.saveNoDamage === true) effect.saveNoDamage = true;
    if (e.banish && typeof e.banish === 'object') {
      const b = e.banish as { x?: unknown; y?: unknown };
      if (typeof b.x === 'number' && typeof b.y === 'number' && Number.isFinite(b.x) && Number.isFinite(b.y)) {
        effect.banish = { x: Math.round(b.x * 10) / 10, y: Math.round(b.y * 10) / 10 };
      }
    }
    if (e.retaliate && typeof e.retaliate === 'object') {
      const r = e.retaliate as { damageType?: unknown; amount?: unknown; dice?: unknown };
      if (typeof r.damageType === 'string' && r.damageType) {
        const retaliate: NonNullable<EffectInstance['retaliate']> = { damageType: r.damageType.slice(0, 40) };
        if (typeof r.dice === 'string' && r.dice.trim()) retaliate.dice = r.dice.trim().slice(0, 40);
        else retaliate.amount = clampInt(r.amount, 0, 999, 0);
        effect.retaliate = retaliate;
      }
    }
    if (e.takesExtraDamage && typeof e.takesExtraDamage === 'object') {
      const extra = e.takesExtraDamage as { dice?: unknown; damageType?: unknown };
      if (
        typeof extra.dice === 'string' &&
        extra.dice.trim() &&
        typeof extra.damageType === 'string' &&
        extra.damageType
      ) {
        effect.takesExtraDamage = {
          dice: extra.dice.trim().slice(0, 40),
          damageType: extra.damageType.slice(0, 40),
        };
      }
    }
    if (e.charges && typeof e.charges === 'object') {
      const charges = e.charges as { remaining?: unknown; on?: unknown };
      if (charges.on === 'rangedWeaponAttack') {
        effect.charges = { remaining: clampInt(charges.remaining, 0, 99, 0), on: 'rangedWeaponAttack' };
      }
    }
    if (e.onWillingMove && typeof e.onWillingMove === 'object') {
      const m = e.onWillingMove as { dice?: unknown; damageType?: unknown; feet?: unknown };
      if (typeof m.dice === 'string' && m.dice.trim() && typeof m.damageType === 'string' && m.damageType) {
        effect.onWillingMove = {
          dice: m.dice.trim().slice(0, 40),
          damageType: m.damageType.slice(0, 40),
          feet: clampInt(m.feet, 5, 120, 5),
        };
      }
    }
    if (e.zephyrStrike && typeof e.zephyrStrike === 'object') {
      const z = e.zephyrStrike as { dice?: unknown; damageType?: unknown; speedFeet?: unknown };
      if (typeof z.dice === 'string' && z.dice.trim() && typeof z.damageType === 'string' && z.damageType) {
        effect.zephyrStrike = {
          dice: z.dice.trim().slice(0, 40),
          damageType: z.damageType.slice(0, 40),
          speedFeet: clampInt(z.speedFeet, 5, 120, 30),
        };
      }
    }
    if (Array.isArray(e.ward)) {
      const types = e.ward.filter((t): t is string => typeof t === 'string' && !!t).slice(0, 12);
      if (types.length) effect.ward = [...new Set(types)];
    }
    if (Array.isArray(e.breakOn)) {
      const events = e.breakOn.filter(
        (k): k is 'attack' | 'spell' | 'damage' => k === 'attack' || k === 'spell' || k === 'damage'
      );
      if (events.length) effect.breakOn = [...new Set(events)];
    }
    if (e.sanctuary && typeof e.sanctuary === 'object') {
      const ward = e.sanctuary as { dc?: unknown };
      effect.sanctuary = { dc: clampInt(ward.dc, 0, 40, 10) };
    }
    if (Array.isArray(e.conditionImmunities)) {
      const immune = e.conditionImmunities
        .filter((k): k is ConditionKey => typeof k === 'string' && (CONDITION_KEYS as string[]).includes(k))
        .slice(0, 10);
      if (immune.length) effect.conditionImmunities = [...new Set(immune)];
    }
    if (e.conditionImmunitiesFrom && typeof e.conditionImmunitiesFrom === 'object') {
      const raw = e.conditionImmunitiesFrom as { conditions?: unknown; types?: unknown };
      const conditions = Array.isArray(raw.conditions)
        ? raw.conditions.filter((k): k is ConditionKey => typeof k === 'string' && (CONDITION_KEYS as string[]).includes(k))
        : [];
      const types = Array.isArray(raw.types)
        ? raw.types.filter((t): t is string => typeof t === 'string' && CREATURE_TYPES.some((c) => c.key === t))
        : [];
      if (conditions.length && types.length) {
        effect.conditionImmunitiesFrom = {
          conditions: [...new Set(conditions)].slice(0, 10),
          types: [...new Set(types)].slice(0, 14),
        };
      }
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
    if (e.escape && typeof e.escape === 'object') {
      const esc = e.escape as { kind?: unknown; ability?: unknown; skill?: unknown; dc?: unknown; label?: unknown; iconKey?: unknown };
      if (isAbilityKey(esc.ability)) {
        effect.escape = {
          ability: esc.ability,
          dc: clampInt(esc.dc, 0, 40, 10),
          ...(esc.kind === 'save' ? { kind: 'save' as const } : {}),
          ...(typeof esc.skill === 'string' && esc.skill ? { skill: esc.skill.slice(0, 40) } : {}),
          ...(typeof esc.label === 'string' && esc.label ? { label: esc.label.slice(0, 40) } : {}),
          ...(typeof esc.iconKey === 'string' && esc.iconKey ? { iconKey: esc.iconKey.slice(0, 80) } : {}),
        };
      }
    }
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
    // Поля, которые исторически терялись при перезагрузке: эскалация, пробуждение,
    // ограничения, кости, образы и выданные действия (см. effectFieldsFromDef).
    if (e.escalate && typeof e.escalate === 'object') {
      const esc = e.escalate as { condition?: unknown; duration?: unknown };
      if (typeof esc.condition === 'string' && (CONDITION_KEYS as string[]).includes(esc.condition)) {
        const duration = normalizeEffectDuration(esc.duration);
        effect.escalate = { condition: esc.condition as ConditionKey, ...(duration ? { duration } : {}) };
      }
    }
    if (e.wakeOnDamage === true) effect.wakeOnDamage = true;
    if (e.saveOnDamage && typeof e.saveOnDamage === 'object') {
      const sod = e.saveOnDamage as { advantage?: unknown };
      effect.saveOnDamage = sod.advantage === true ? { advantage: true } : {};
    }
    if (e.restrictions && typeof e.restrictions === 'object') {
      const raw = e.restrictions as Record<string, unknown>;
      const restrictions: Restrictions = {};
      for (const key of RESTRICTION_KEYS) {
        if (raw[key] === true) restrictions[key] = true;
      }
      if (typeof raw.spellFailureChance === 'number' && Number.isFinite(raw.spellFailureChance)) {
        restrictions.spellFailureChance = clampInt(raw.spellFailureChance, 0, 100, 0);
      }
      if (Object.keys(restrictions).length) effect.restrictions = restrictions;
    }
    if (typeof e.bonusDie === 'string' && e.bonusDie.trim()) effect.bonusDie = e.bonusDie.trim().slice(0, 40);
    if (Array.isArray(e.bonusDieUses)) {
      const uses = e.bonusDieUses.filter((u): u is 'damage' | 'ac' => u === 'damage' || u === 'ac');
      if (uses.length) effect.bonusDieUses = [...new Set(uses)];
    }
    if (e.misdirect && typeof e.misdirect === 'object') {
      const m = e.misdirect as { charges?: unknown; die?: unknown; threshold?: unknown };
      if (typeof m.die === 'string' && m.die.trim()) {
        effect.misdirect = {
          charges: clampInt(m.charges, 0, 20, 0),
          die: m.die.trim().slice(0, 10),
          threshold: clampInt(m.threshold, 2, 20, 3),
        };
      }
    }
    if (Array.isArray(e.actions)) {
      const actions = e.actions.filter(
        (a): a is GrantedAction =>
          !!a &&
          typeof a === 'object' &&
          typeof (a as GrantedAction).id === 'string' &&
          typeof (a as GrantedAction).name === 'string' &&
          ((a as GrantedAction).cost === 'action' || (a as GrantedAction).cost === 'bonus')
      );
      if (actions.length) effect.actions = actions.slice(0, 8);
    }
    out.push(effect);
  }
  return out;
}
