import {
  actionSlotAvailable,
  automationForSpell,
  castableLevels,
  characterLevel,
  isHealingSpell,
  maxCastableLevel,
  spellActionCost,
  spellAttackCount,
  spellAutomated,
  spellDamageExpression,
  spellExtraTargets,
  spellHasArea,
  spellTargetKind,
  type ActionCost,
  type ActionDef,
  type AutomationPayload,
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

/** Накладывает ли заклинание эффекты — напрямую или аурой/триггерами зоны. */
export function spellHasEffects(spell: Spell): boolean {
  const payload = (p: AutomationPayload | undefined) => !!p?.effects?.length;
  const def = automationForSpell(spell);
  if (payload(def)) return true;
  const zone = def.zone;
  if (!zone) return false;
  return payload(zone.aura) || Object.values(zone.triggers ?? {}).some(payload);
}

/** Порядок иконок: эффекты → авто-механика → неавтоматизированные (красная точка), внутри — круг и название. */
export function sortPanelSpells(spells: Spell[]): Spell[] {
  const rank = (s: Spell) => (spellAutomated(s) ? (spellHasEffects(s) ? 0 : 1) : 2);
  return [...spells].sort(
    (a, b) => rank(a) - rank(b) || a.level - b.level || a.name.localeCompare(b.name)
  );
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

/** Круги ячеек в наличии для апкаста (без пустых промежуточных кругов). */
export function castLevelsForSpell(spell: Spell, caster: CasterInfo): number[] {
  if (caster.isCharacter) return castableLevels(spell, caster.resources ?? null);
  return castableLevels(spell, null, caster.token?.statblock?.spellcasting?.slots);
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
  if (actionId === 'attack') return turn.attacksRemaining > 0 || turn.flurryAttacks > 0 || actionSlotAvailable(turn, slot);
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
  /** Мультивыбор: существа-цели (без повторов) или снаряды. */
  multiKind: 'targets' | 'projectiles';
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
  const def = automationForSpell(spell, { castLevel: level, characterLevel: charLevel });
  const baseTargets = Math.max(
    def.targets ?? 0,
    def.effects?.reduce((max, d) => Math.max(max, d.to === 'targets' ? d.targets ?? 1 : 0), 0) ?? 0
  );
  // Апкаст на несколько целей (Hold Person: +1 существо за круг выше 2-го).
  const effectTargetCount = baseTargets ? baseTargets + spellExtraTargets(spell, level) : 0;
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
  const levels = isCantrip || !canCast ? [] : castLevelsForSpell(spell, caster);
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
    multiKind: effectTargetCount > 1 ? 'targets' : 'projectiles',
    attacky,
    expression,
    damageText,
    slotLevel: isCantrip ? undefined : level,
  };
}
