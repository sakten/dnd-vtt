import {
  applyDamageDefenses,
  damageLinks,
  gridDistanceFeet,
  rollDice,
  triggerOn,
  triggersOn,
  type DamageDefense,
  type DamageDefenseType,
  type DiceRollResult,
  type EffectInstance,
  type RollLabelParams,
  type Token,
  type TriggerInstance,
} from 'shared';
import { gridSizeOfMap } from '../rooms';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';
import { runAbilityTriggers } from './abilityTriggers';
import { removeBrokenEffects } from './effectsApply';
import { pushRollMessage, pushSaveMessage } from './messages';

/**
 * Диспетчеры триггеров (R14, `AUTOMATION.md` §3.2): единые точки событий
 * `targetedByAttack` (гейт) и `damaged` (фазы before/after). Порядок фаз —
 * контракт, закреплённый тестами. hp-level операции (wake/Death Ward/repeatSave)
 * остаются в HP-пайплайне и зажигаются только событием урона (`damageEvent`),
 * но не ручными правками HP мастера.
 */

export interface DamageEvent {
  target: Token;
  mapId: string;
  attacker?: Token;
  /** Ближняя атака — ответный урон срабатывает. */
  melee?: boolean;
  /** Урон нельзя уменьшить: защиты, Resistance и перенос Warding Bond пропускаются. */
  unreducible?: boolean;
  defenses: DamageDefense[];
  /** Части урона (или одна группа) — как пришли в `applyDamage`. */
  groups: { amount: number; damageType?: string }[];
  groupTypes: string[];
  /** Сумма урона после защит/половины; фазы меняют её на месте. */
  amount: number;
  /** Заметка защит (сопротивления/иммунитеты) для карточки броска. */
  note?: DamageDefenseType;
  /** Внутреннее состояние фаз: сработавшее снижение урона (Resistance). */
  reduction?: { effect: EffectInstance; type: string; reducedBy: number };
  /** HP цели до урона (Death Ward/ответка читают её). */
  hpBefore: number;
  /** Временные HP до урона (Armor of Agathys: ответка только если были). */
  tempBefore: number;
  /** Карточка броска: фаза `before` печатает её между снижением и бейном. */
  roll?: DiceRollResult;
  author?: string;
  params?: RollLabelParams;
  crit?: boolean;
}

/** Снимает все связи Warding Bond, ведущие на павшего/исчезнувшего источника. */
function dropDamageLinks(ctx: ConnCtx, room: Room, sourceId: string): void {
  for (const map of room.scene.maps) {
    for (const token of map.tokens) {
      for (const effect of [...token.effects]) {
        if (!triggersOn([effect], 'damaged').some((t) => t.redirect)) continue;
        if (effect.sourceId !== sourceId) continue;
        if (ctx.manager.removeEffect(room, token, effect.id)) ctx.emitToken(room, 'token:update', map.id, token);
      }
    }
  }
}

/** Warding Bond: урон носителя переносится на источник тем же количеством (без защит, ≤60 фт). */
function transferLinkedDamage(ctx: ConnCtx, room: Room, mapId: string, target: Token, amount: number): void {
  const sourceIds = damageLinks(target.effects);
  if (!sourceIds.length) return;
  const mapInfo = ctx.manager.findMap(room, mapId);
  if (!mapInfo) return;
  const grid = gridSizeOfMap(mapInfo);
  for (const sourceId of sourceIds) {
    const effect = target.effects.find(
      (e) => e.sourceId === sourceId && triggersOn([e], 'damaged').some((t) => t.redirect)
    );
    if (!effect) continue;
    const drop = (): void => {
      if (ctx.manager.removeEffect(room, target, effect.id)) ctx.emitToken(room, 'token:update', mapId, target);
    };
    const located = ctx.manager.locateToken(room, sourceId);
    if (!located || located.mapId !== mapId || gridDistanceFeet(target, located.token, grid) > 60) {
      drop();
      continue;
    }
    // Перенос — тоже получение урона: hp-триггеры источника зажигаются.
    ctx.applyHp(room, located.mapId, located.token, -amount, { damageEvent: true });
    if ((located.token.hpCurrent ?? 0) <= 0) dropDamageLinks(ctx, room, sourceId);
  }
}

/** Resistance: первый подходящий по типу урона заряд снижения у цели. */
function damageReductionFor(
  target: Token,
  damageTypes: string[]
): { effect: EffectInstance; type: string; dice: string } | undefined {
  for (const effect of target.effects) {
    const reduce = (effect.triggers ?? []).find((t) => t.on === 'damaged' && t.reduce)?.reduce;
    if (!reduce || (effect.charges?.remaining ?? 0) <= 0) continue;
    const type = damageTypes.find((t) => reduce.types.includes(t));
    if (type) return { effect, type, dice: reduce.dice };
  }
  return undefined;
}

/** Ключ текущего хода карты (round:entryId) для «раз за ход»; вне боя — null. */
function currentTurnKey(ctx: ConnCtx, room: Room, mapId: string | null): string | null {
  const map = mapId ? ctx.manager.findMap(room, mapId) : undefined;
  const combat = map?.combat;
  if (!combat?.active || combat.currentIndex < 0) return null;
  const entry = combat.entries[combat.currentIndex];
  return entry ? `${combat.round}:${entry.id}` : null;
}

/** Elemental Bane: эффект с триггером «раз в ход», чей тип есть в уроне и не срабатывал в текущем ходу. */
function elementalBaneFor(
  target: Token,
  damageTypes: string[],
  turn: string | null
): { effect: EffectInstance; trigger: TriggerInstance } | undefined {
  for (const effect of target.effects) {
    for (const trigger of effect.triggers ?? []) {
      const extra = trigger.extraDamage;
      if (trigger.on !== 'damaged' || !extra?.oncePerTurn) continue;
      if (trigger.usedTurn !== turn && damageTypes.includes(extra.damageType)) return { effect, trigger };
    }
  }
  return undefined;
}

type DamagePhase = 'before' | 'after';

interface DamageStep {
  phase: DamagePhase;
  run: (ctx: ConnCtx, room: Room, e: DamageEvent) => void;
}

/** Снижение урона (Resistance): кость снимается с суммы, заряд тратится. */
function reduceStep(ctx: ConnCtx, room: Room, e: DamageEvent): void {
  const reduction = e.unreducible ? undefined : damageReductionFor(e.target, e.groupTypes);
  if (!reduction) return;
  const reducedBy = rollDice(reduction.dice).total;
  const charges = reduction.effect.charges;
  if (charges) charges.remaining = Math.max(0, charges.remaining - 1);
  e.amount = Math.max(0, e.amount - reducedBy);
  e.reduction = { ...reduction, reducedBy };
}

/** Карточка броска урона — между снижением и Elemental Bane (как раньше). */
function rollCardStep(ctx: ConnCtx, room: Room, e: DamageEvent): void {
  if (!e.roll || !e.author || !e.params) return;
  pushRollMessage(ctx, room, {
    author: e.author,
    roll: e.roll,
    kind: 'damage',
    params: { ...e.params, damageNote: e.note },
    crit: e.crit,
  });
}

/** Сообщение о сработавшем снижении (Resistance) — после карточки. */
function reduceMessageStep(ctx: ConnCtx, room: Room, e: DamageEvent): void {
  const reduction = e.reduction;
  if (!reduction) return;
  ctx.emitToken(room, 'token:update', e.mapId, e.target);
  ctx.systemMessage(room, {
    code: 'automation.damageReduce',
    params: { name: e.target.name, amount: reduction.reducedBy, type: reduction.type },
  });
}

/** Elemental Bane: первый урон выбранного типа за ход — доп. кости того же типа. */
function baneStep(ctx: ConnCtx, room: Room, e: DamageEvent): void {
  const turn = currentTurnKey(ctx, room, e.mapId);
  const bane = e.amount > 0 ? elementalBaneFor(e.target, e.groupTypes, turn) : undefined;
  if (!bane) return;
  const extra = bane.trigger.extraDamage!;
  const baneRoll = rollDice(extra.dice);
  const defense = e.unreducible
    ? { amount: baneRoll.total }
    : applyDamageDefenses(baneRoll.total, extra.damageType, e.defenses);
  e.amount += defense.amount;
  bane.trigger.usedTurn = turn;
  const source = bane.effect.sourceId ? ctx.manager.locateToken(room, bane.effect.sourceId)?.token : undefined;
  pushRollMessage(ctx, room, {
    author: source?.name ?? bane.effect.name,
    roll: baneRoll,
    kind: 'damage',
    params: {
      subject: `${bane.effect.name} · ${e.target.name}`,
      damageType: extra.damageType,
      damageNote: defense.note,
    },
  });
}

/** Warding Bond: урон носителя переносится на источник тем же количеством (≤60 фт). */
function linkStep(ctx: ConnCtx, room: Room, e: DamageEvent): void {
  if (e.unreducible) return;
  transferLinkedDamage(ctx, room, e.mapId, e.target, e.amount);
}

/** Триггеры монстра «при получении урона» — на каждый урон. */
function abilityTakeDamageStep(ctx: ConnCtx, room: Room, e: DamageEvent): void {
  runAbilityTriggers(ctx, room, e.mapId, e.target, 'takeDamage');
}

/** Триггеры монстра «при смерти» — переход HP к 0. */
function abilityDeathStep(ctx: ConnCtx, room: Room, e: DamageEvent): void {
  if (e.hpBefore > 0 && (e.target.hpCurrent ?? 0) <= 0) runAbilityTriggers(ctx, room, e.mapId, e.target, 'death');
}

/** Носитель с триггером `ownDamageDealt`/`endEffect` нанёс урон — эффект обрывается (Invisibility). */
function breakOwnDamageDealtStep(ctx: ConnCtx, room: Room, e: DamageEvent): void {
  if (!e.attacker || e.attacker.id === e.target.id) return;
  removeBrokenEffects(ctx, room, e.mapId, e.attacker, 'ownDamageDealt');
}

/**
 * Реестр шагов события `damaged`: фаза и порядок — контракт (закреплён тестами).
 * Новые реакции добавляются шагом, а не правкой `applyDamage`.
 */
const DAMAGE_STEPS: DamageStep[] = [
  { phase: 'before', run: reduceStep },
  { phase: 'before', run: rollCardStep },
  { phase: 'before', run: reduceMessageStep },
  { phase: 'before', run: baneStep },
  { phase: 'after', run: linkStep },
  { phase: 'after', run: abilityTakeDamageStep },
  { phase: 'after', run: abilityDeathStep },
  { phase: 'after', run: breakOwnDamageDealtStep },
];

/** Прогон фазы события урона в объявленном порядке реестра. */
export function runDamagePhase(phase: DamagePhase, ctx: ConnCtx, room: Room, e: DamageEvent): void {
  for (const step of DAMAGE_STEPS) if (step.phase === phase) step.run(ctx, room, e);
}

/** Фаза `before`: до применения HP (Resistance, карточка, Elemental Bane). */
export function beforeDamage(ctx: ConnCtx, room: Room, e: DamageEvent): void {
  runDamagePhase('before', ctx, room, e);
}

/** Фаза `after`: после применения HP (Warding Bond, триггеры монстра, обрыв эффектов). */
export function afterDamage(ctx: ConnCtx, room: Room, e: DamageEvent): void {
  runDamagePhase('after', ctx, room, e);
}

/**
 * Гейт `targetedByAttack` (Sanctuary): атакующий защищённую цель проходит спас Мдр
 * (СЛ каста) или теряет атаку/заклинание. Одна точка входа для оружия и заклинаний.
 * Возвращает true — цель заблокирована.
 */
export function gateAttackOnTarget(
  ctx: ConnCtx,
  room: Room,
  attacker: Token | null | undefined,
  target: Token | null | undefined
): boolean {
  if (!attacker || !target || attacker.id === target.id) return false;
  const ward = target.effects.find((e) => triggerOn(e, 'targetedByAttack')?.save);
  if (!ward) return false;
  const dc = triggerOn(ward, 'targetedByAttack')?.save?.dc ?? 10;
  const { roll, success } = ctx.manager.rollSave(room, attacker, 'wis', dc);
  pushSaveMessage(ctx, room, { author: attacker.name, subject: `Sanctuary · ${attacker.name}`, roll, success });
  if (success) return false;
  ctx.systemMessage(room, {
    code: 'automation.sanctuary',
    params: { name: target.name, attacker: attacker.name },
  });
  return true;
}
