import {
  actionSlotAvailable,
  characterLevel,
  isHealingSpell,
  maxCastableLevel,
  spellActionCost,
  spellAttackCount,
  spellDamageExpression,
  spellEffectDefs,
  spellHasArea,
  spellTargetKind,
  type ActionCost,
  type ActionDef,
  type CharacterSheet,
  type PlayerResources,
  type Spell,
  type Token,
  type TurnState,
} from 'shared';

/** Секция панели для заклинания; 'other' — свободные/особые. */
export function spellSlotOf(spell: Spell): 'action' | 'bonus' | 'reaction' | 'other' {
  const cost = spellActionCost(spell);
  return cost === 'action' || cost === 'bonus' || cost === 'reaction' ? cost : 'other';
}

export const ACTION_COST_TEXT: Record<ActionCost, string> = {
  action: 'Действие',
  bonus: 'Бонусное действие',
  reaction: 'Реакция',
  movement: 'Передвижение',
  legendary: 'Легендарное',
  lair: 'Логово',
  free: 'Свободное',
  special: 'Особое',
};

/** Кастер заклинания: персонаж (ячейки в ресурсах) или монстр (ячейки статблока). */
export interface CasterInfo {
  isCharacter: boolean;
  resources: PlayerResources | null;
  token: Token | undefined;
}

/** Максимальный доступный круг заклинания для кастера. */
export function maxCastableForSpell(spell: Spell, caster: CasterInfo): number {
  if (caster.isCharacter) return maxCastableLevel(spell, caster.resources ?? null);
  return maxCastableLevel(spell, null, caster.token?.statblock?.spellcasting?.slots);
}

/** Контекст хода для проверок экономики действий. */
export interface TurnContext {
  combatActive: boolean;
  isActive: boolean;
  turn: TurnState | null | undefined;
  ownTurn: TurnState | null | undefined;
  incapacitated: boolean;
  controlled: boolean;
}

/** Доступен ли слот для действия (без учёта ресурсов/ячеек). */
export function canSpendSlot(ctx: TurnContext, slot: ActionCost, actionId: string): boolean {
  if (ctx.incapacitated || !ctx.controlled) return false;
  if (!ctx.combatActive) return true;
  if (!ctx.isActive && slot !== 'reaction') return false;
  const turn = ctx.isActive ? ctx.turn : ctx.ownTurn;
  if (!turn) return ctx.isActive ? false : true;
  if (actionId === 'attack') return turn.attacksRemaining > 0 || actionSlotAvailable(turn, slot);
  return actionSlotAvailable(turn, slot);
}

/** Хватает ли ресурса на классовую черту и доступен ли её слот. */
export function canUseFeature(f: ActionDef, ctx: TurnContext, resourceLeft: number | null): boolean {
  if (ctx.incapacitated || !ctx.controlled) return false;
  const amount = Math.max(1, f.resourceAmount ?? 1);
  if (resourceLeft !== null && resourceLeft < amount) return false;
  if (!ctx.combatActive) return true;
  if (!ctx.isActive && !f.costs.includes('reaction')) return false;
  const turn = ctx.isActive ? ctx.turn : ctx.ownTurn;
  if (!turn) return ctx.isActive ? false : true;
  return f.costs.some((c) => actionSlotAvailable(turn, c));
}

/** Слот для черты: доступный из её cost или первый заявленный. */
export function featureSlot(f: ActionDef, ctx: TurnContext): ActionCost {
  if (!ctx.combatActive) return f.costs[0] ?? 'special';
  if (!ctx.isActive && f.costs.includes('reaction')) return 'reaction';
  const turn = ctx.isActive ? ctx.turn : ctx.ownTurn;
  if (!turn) return f.costs[0] ?? 'special';
  return f.costs.find((c) => actionSlotAvailable(turn, c)) ?? f.costs[0] ?? 'special';
}

/** Данные попапа заклинания: доступный круг, режим цели, урон/лечение. */
export interface SpellCastInfo {
  isCantrip: boolean;
  maxLevel: number;
  canCast: boolean;
  levels: number[];
  area: boolean;
  self: boolean;
  projectiles: number;
  effectTargetCount: number;
  multi: boolean;
  multiCount: number;
  attacky: boolean;
  expression: string | null;
  damageText: string | null;
  /** Круг ячейки для накладывания; undefined — фокус. */
  slotLevel: number | undefined;
}

export function spellCastInfo(
  spell: Spell,
  level: number,
  caster: CasterInfo & { classes: CharacterSheet['classes'] | null }
): SpellCastInfo {
  const isCantrip = spell.level === 0;
  const maxLevel = maxCastableForSpell(spell, caster);
  const canCast = isCantrip || maxLevel >= spell.level;
  const area = spellHasArea(spell);
  const self = spellTargetKind(spell) === 'self';
  const charLevel = caster.classes ? characterLevel(caster.classes) : 1;
  const projectiles = spellAttackCount(spell, level, charLevel);
  const effectTargetCount =
    spellEffectDefs(spell.key)?.reduce((max, d) => Math.max(max, d.to === 'targets' ? d.targets ?? 1 : 0), 0) ?? 0;
  const multi = !area && (projectiles > 1 || effectTargetCount > 1);
  const multiCount = effectTargetCount > 1 ? effectTargetCount : projectiles;
  const attacky = !!spell.spellAttack || !!spell.save;
  const expression = spellDamageExpression(spell, level, charLevel);
  const damageText =
    expression && spell.damage
      ? `${isHealingSpell(spell) ? 'Лечение' : 'Урон'}: ${expression}${
          spell.damage.types.length ? ` (${spell.damage.types.join(', ')})` : ''
        }`
      : null;
  const levels =
    isCantrip || !canCast ? [] : Array.from({ length: maxLevel - spell.level + 1 }, (_, i) => spell.level + i);
  return {
    isCantrip,
    maxLevel,
    canCast,
    levels,
    area,
    self,
    projectiles,
    effectTargetCount,
    multi,
    multiCount,
    attacky,
    expression,
    damageText,
    slotLevel: isCantrip ? undefined : level,
  };
}
