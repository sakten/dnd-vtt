import {
  actionSlotAvailable,
  actionTargeting,
  automationForAction,
  casterStats,
  classFeatures,
  consumeSlotTurn,
  crossesWalls,
  featureActionAutomation,
  findBaseAction,
  findUnarmedAttack,
  firstSentence,
  gridDistanceFeet,
  gridOfMap,
  legendaryOnly,
  masteryAccessible,
  monsterStats,
  restrictionsFor,
  rollDice,
  slotSpendable,
  tokenVisibleFrom,
  tokensInArea,
  unarmedStrikeEntry as computedUnarmedStrike,
  weaponAttackEntry,
  weaponByKey,
  weaponHasProperty,
  weaponMastery,
  withAdvantage,
  type ActionCost,
  type ActionDef,
  type AreaSpec,
  type AttackEntry,
  type AutomationDef,
  type CharacterSheet,
  type DiceRollResult,
  type EffectInstance,
  type SpellStats,
  type Token,
  type TurnState,
} from 'shared';
import type { ConnCtx } from './context';
import { executeAutomation } from './automation';
import { fail } from './errors';
import { applyEffectTo } from './effectsApply';
import { rejectIfIncapacitated, rejectIfReaction, rejectIfSpellsBlocked, scopedToken, type Scope } from './guards';
import { shapeAttacks, shapeStatblock } from '../room/shape';
import { sheetOfToken } from '../room/helpers';
import { moveZone } from './zones';
import { pushRollMessage } from './messages';
import { resolveSpellCastWithReactions, resolveWeaponAttackWithReactions } from './reactions';
import { maybeRollAnim } from './rollAnim';
import { findSpell } from '../spells';
import { spellClassFor, spellStatsFor } from './spellStats';
import { collectSpellCast } from './spellTargeting';
import { validateSpellCast } from './spellResolve';

/** Слот, которым будет оплачено действие: запрошенный, если доступен, иначе первый доступный. */
function chooseSlot(turn: TurnState | null, costs: ActionCost[], requested?: ActionCost): ActionCost {
  const order = requested && costs.includes(requested) ? [requested, ...costs.filter((c) => c !== requested)] : costs;
  if (!turn) return order[0] ?? 'action';
  return order.find((c) => actionSlotAvailable(turn, c)) ?? order[order.length - 1] ?? 'action';
}

/** Действие «Выпутаться»: проверка характеристики снимает эффект (Web: STR/Athletics). */
function escapeEffect(
  ctx: ConnCtx,
  scope: Scope,
  effectId: string,
  advantage?: 'a' | 'd'
): void {
  const { room, mapId, token } = scope;
  const effect = token.effects.find((e) => e.id === effectId);
  const escape = effect?.escape;
  if (!effect || !escape) return;

  const combat = ctx.manager.combatOf(room, mapId);
  const isActive = !combat?.active || ctx.manager.isActiveToken(room, mapId, token.id);
  if (combat?.active && !isActive && !ctx.isDm()) {
    fail(ctx, 'notYourTurn');
    return;
  }

  const expression = withAdvantage(
    ctx.manager.abilityCheckExprForToken(room, token, escape.ability, escape.skill),
    advantage === 'a' || advantage === 'd' ? advantage : null
  );
  const applyCheck = (roll: DiceRollResult) => {
    const success = roll.total >= escape.dc;
    pushRollMessage(ctx, room, {
      author: token.name,
      roll,
      kind: 'check',
      params: { subject: `Выпутаться: ${effect.name}` },
    });
    maybeRollAnim(ctx, roll);
    if (!success) return;
    ctx.manager.removeEffect(room, token, effect.id);
    ctx.emitToken(room, 'token:update', mapId, token);
    ctx.systemMessage(room, { code: 'actions.escaped', params: { name: token.name, effect: effect.name } });
  };

  if (!ctx.manager.spendSlot(room, mapId, token, 'action')) {
    fail(ctx, 'noActions');
    return;
  }
  ctx.syncCombat(room, mapId);
  applyCheck(rollDice(expression));
}

/** Считается ли цель «убитой» для переноса метки: HP ≤ 0 или состояние без сознания/смерти. */
function targetDowned(ctx: ConnCtx, room: Scope['room'], token: Token): boolean {
  if (token.conditions.some((c) => c.key === 'unconscious' || c.key === 'dead')) return true;
  const controllerId = ctx.manager.controllerOfToken(room, token);
  const hp = controllerId ? room.resources[controllerId]?.hp.current : token.hpCurrent;
  return (hp ?? 1) <= 0;
}

/** Перенос метки Hex/Hunter's Mark на новую цель: только после смерти текущей, бонусным действием. */
function retargetMark(
  ctx: ConnCtx,
  room: Scope['room'],
  mapId: string,
  token: Token,
  mark: EffectInstance,
  def: AutomationDef,
  targetIds: unknown,
  slot?: ActionCost
): void {
  const newTargetId = (Array.isArray(targetIds) ? targetIds : []).find((id) => typeof id === 'string');
  const newTarget = typeof newTargetId === 'string' ? ctx.manager.findToken(room, mapId, newTargetId) : undefined;
  if (!newTarget) {
    fail(ctx, 'spellNoTarget');
    return;
  }
  const markedId = mark.modifiers.find((m) => m.filter?.targetId)?.filter?.targetId;
  const marked = markedId ? ctx.manager.findToken(room, mapId, markedId) : undefined;
  if (marked && !targetDowned(ctx, room, marked)) {
    fail(ctx, 'markTargetAlive');
    return;
  }

  const map = ctx.manager.findMap(room, mapId);
  const grid = gridOfMap(map, room.scene.grid);
  const range = def.targeting?.range ?? 90;
  const feet = gridDistanceFeet(token, newTarget, grid.size);
  if (feet > range) {
    fail(ctx, 'outOfRange', { feet: Math.round(feet) });
    return;
  }
  if (map && !tokenVisibleFrom(token, newTarget, map.walls, grid)) {
    fail(ctx, 'noClearPath');
    return;
  }

  const combat = ctx.manager.combatOf(room, mapId);
  const isActive = !combat?.active || ctx.manager.isActiveToken(room, mapId, token.id);
  if (combat?.active && !isActive && !ctx.isDm()) {
    fail(ctx, 'notYourTurn');
    return;
  }
  const turn = isActive ? ctx.manager.turnForToken(room, mapId, token) : null;
  if (!ctx.manager.spendSlot(room, mapId, token, chooseSlot(turn, ['bonus'], slot))) {
    fail(ctx, 'noActions');
    return;
  }
  ctx.syncCombat(room, mapId);

  // Модификаторы метки (урон) — на новую цель.
  for (const mod of mark.modifiers) {
    if (mod.filter?.targetId) mod.filter = { ...mod.filter, targetId: newTarget.id };
  }
  // Чип метки: снять со старой цели, повесить на новую.
  if (marked && marked.id !== newTarget.id) {
    for (const chip of marked.effects.filter(
      (e) => e.sourceKey === mark.sourceKey && e.sourceId === mark.sourceId && !e.modifiers.length
    )) {
      ctx.manager.removeEffect(room, marked, chip.id);
    }
    ctx.emitToken(room, 'token:update', mapId, marked);
  }
  applyEffectTo(ctx, room, {
    sourceKey: mark.sourceKey ?? def.key,
    sourceId: mark.sourceId ?? token.id,
    mapId,
    effectDef: { name: mark.name, duration: { type: 'concentration' }, concentration: true, to: 'targets', modifiers: [], mark: true },
    target: newTarget,
  });
  ctx.emitToken(room, 'token:update', mapId, token);
  ctx.systemMessage(room, {
    code: 'automation.markMoved',
    params: { name: token.name, feature: mark.name, target: newTarget.name },
  });
}

/**
 * Цели действия: область от точки, выбранные id или сам носитель.
 * Общий сбор для обычных (`action:use`) и выданных эффектом действий.
 */
function actionTargets(
  ctx: ConnCtx,
  room: Scope['room'],
  mapId: string,
  token: Token,
  opts: {
    area?: AreaSpec;
    origin?: { x: number; y: number } | null;
    direction?: { x: number; y: number } | null;
    targetIds?: unknown;
    selfWhenEmpty?: boolean;
  }
): Token[] {
  const targets: Token[] = [];
  if (opts.area && opts.origin) {
    const map = ctx.manager.findMap(room, mapId);
    const grid = gridOfMap(map, room.scene.grid);
    const affected = map
      ? tokensInArea(map.tokens, opts.area, opts.origin, opts.direction ?? null, grid, 'euclidean', map.walls)
      : [];
    for (const found of affected) {
      if (found.id !== token.id) targets.push(found);
    }
    return targets;
  }
  for (const id of Array.isArray(opts.targetIds) ? opts.targetIds : []) {
    if (typeof id !== 'string') continue;
    const found = ctx.manager.findToken(room, mapId, id);
    if (found) targets.push(found);
  }
  if (!targets.length && opts.selfWhenEmpty) targets.push(token);
  return targets;
}

/** Боевые характеристики кастера-источника: лист с классом заклинания или статблок. */
function casterStatsFor(ctx: ConnCtx, room: Scope['room'], caster: Token, spellKey: string): SpellStats | null {
  const sheet = sheetOfToken(room, caster).sheet;
  const className = sheet ? spellClassFor(sheet, spellKey) : undefined;
  return spellStatsFor(room, caster, className);
}

/**
 * Действие зоны (`zone:<zoneId>:<actionId>`): перемещение Moonbeam/Flaming Sphere
 * или удар/эффект зоны (Call Lightning). Доступ — контролёр кастера-источника или DM.
 */
function useZoneAction(
  ctx: ConnCtx,
  room: Scope['room'],
  mapId: string,
  actionId: string,
  opts: { slot?: ActionCost; origin?: { x: number; y: number } }
): void {
  const rest = actionId.slice('zone:'.length);
  const at = rest.indexOf(':');
  if (at < 0) return;
  const map = ctx.manager.findMap(room, mapId);
  const zone = (map?.zones ?? []).find((z) => z.id === rest.slice(0, at));
  const granted = zone?.actions?.find((a) => a.id === rest.slice(at + 1));
  if (!zone || !granted) return;
  const def = granted.def;
  if (!def) return;

  const caster = zone.sourceId ? ctx.manager.findToken(room, mapId, zone.sourceId) : null;
  if (!caster) return;
  if (!ctx.isDm() && !ctx.canControlToken(room, mapId, caster)) {
    fail(ctx, 'notYourToken');
    return;
  }

  const origin = opts.origin && Number.isFinite(opts.origin.x) && Number.isFinite(opts.origin.y) ? opts.origin : null;
  if (!origin) {
    fail(ctx, 'noAreaPoint');
    return;
  }
  const moving = def.utility?.kind === 'moveZone';
  const grid = gridOfMap(map, room.scene.grid);
  const feet = (Math.hypot(origin.x - zone.origin.x, origin.y - zone.origin.y) / grid.size) * 5;
  const limit = moving ? Math.max(0, def.utility?.amount ?? 0) : def.targeting?.range ?? 0;
  if (feet > limit) {
    fail(ctx, 'outOfRange', { feet: Math.round(feet) });
    return;
  }
  if (map && crossesWalls(caster, origin, map.walls, 'sight')) {
    fail(ctx, 'noClearPath');
    return;
  }

  // Удар/эффект зоны требует характеристик кастера — проверяем до списания слота.
  const stats = moving ? null : casterStatsFor(ctx, room, caster, zone.sourceKey);
  if (!moving && (def.save || def.attack) && !stats) {
    fail(ctx, def.save ? 'spellNoDc' : 'spellNoAttack');
    return;
  }

  const combat = ctx.manager.combatOf(room, mapId);
  const isActive = !combat?.active || ctx.manager.isActiveToken(room, mapId, caster.id);
  if (combat?.active && !isActive && !ctx.isDm()) {
    fail(ctx, 'notYourTurn');
    return;
  }
  const turn = isActive ? ctx.manager.turnForToken(room, mapId, caster) : null;
  if (!ctx.manager.spendSlot(room, mapId, caster, chooseSlot(turn, [granted.cost], opts.slot))) {
    fail(ctx, 'noActions');
    return;
  }
  ctx.syncCombat(room, mapId);

  if (moving) {
    moveZone(ctx, room, mapId, zone, origin);
    ctx.systemMessage(room, {
      code: 'automation.zoneMoved',
      params: { name: caster.name, feature: zone.name },
    });
    return;
  }

  const area = def.targeting?.kind === 'area' ? def.targeting.area : undefined;
  const targets = actionTargets(ctx, room, mapId, caster, { area, origin, selfWhenEmpty: !area });
  const author = room.players.find((p) => p.id === ctx.playerId)?.name ?? '?';
  executeAutomation(ctx, {
    caster,
    mapId,
    def: { ...def, name: granted.name },
    targets,
    stats,
    author,
    origin,
    direction: null,
    area: area ?? null,
  });
}

/**
 * Действие, выданное эффектом (`spell:<effectId>:<actionId>`): Рывок от
 * Expeditious Retreat, Выдох от Dragon's Breath и подобные. Слот — по стоимости
 * действия эффекта; спасброски/атаки считаются по характеристикам кастера.
 */
function useGrantedAction(
  ctx: ConnCtx,
  scope: Scope,
  actionId: string,
  opts: {
    advantage?: 'a' | 'd';
    slot?: ActionCost;
    origin?: { x: number; y: number };
    direction?: { x: number; y: number };
    targetIds?: string[];
  }
): void {
  const { room, mapId, token } = scope;
  const rest = actionId.slice('spell:'.length);
  const at = rest.indexOf(':');
  if (at < 0) return;
  const effect = token.effects.find((e) => e.id === rest.slice(0, at));
  const granted = effect?.actions?.find((a) => a.id === rest.slice(at + 1));
  if (!effect || !granted) return;

  const base = granted.baseActionId ? findBaseAction(granted.baseActionId) : undefined;
  const def = base ? automationForAction(base) : granted.def;
  if (!def) return;

  // Перенос метки (Hex/Hunter's Mark): своя логика — проверки, слот, обновление filter.targetId.
  if (def.retarget) {
    retargetMark(ctx, room, mapId, token, effect, def, opts.targetIds, opts.slot);
    return;
  }

  const targeting = granted.def?.targeting;
  const area = targeting?.kind === 'area' ? targeting.area : undefined;
  const origin = opts.origin && Number.isFinite(opts.origin.x) && Number.isFinite(opts.origin.y) ? opts.origin : null;
  if (area && !origin) {
    fail(ctx, 'noAreaPoint');
    return;
  }

  // СЛ/атака выданного действия считаются по характеристикам кастера-источника
  // (лист с классом заклинания или статблок); без них сейв молча пропускался бы.
  const caster = effect.sourceId ? ctx.manager.findToken(room, mapId, effect.sourceId) ?? undefined : undefined;
  const stats = caster ? casterStatsFor(ctx, room, caster, def.key) : null;
  if ((def.save || def.attack) && !stats) {
    fail(ctx, def.save ? 'spellNoDc' : 'spellNoAttack');
    return;
  }

  const combat = ctx.manager.combatOf(room, mapId);
  const isActive = !combat?.active || ctx.manager.isActiveToken(room, mapId, token.id);
  if (combat?.active && !isActive && !ctx.isDm()) {
    fail(ctx, 'notYourTurn');
    return;
  }
  const turn = isActive ? ctx.manager.turnForToken(room, mapId, token) : null;
  if (!ctx.manager.spendSlot(room, mapId, token, chooseSlot(turn, [granted.cost], opts.slot))) {
    fail(ctx, 'noActions');
    return;
  }
  ctx.syncCombat(room, mapId);

  const targets = actionTargets(ctx, room, mapId, token, {
    area,
    origin,
    direction: opts.direction ?? null,
    targetIds: opts.targetIds,
    selfWhenEmpty: def.targeting?.kind !== 'creature',
  });

  const author = room.players.find((p) => p.id === ctx.playerId)?.name ?? '?';
  executeAutomation(ctx, {
    caster: token,
    mapId,
    def: { ...def, name: granted.name },
    targets,
    stats,
    author,
    advantage: opts.advantage,
    origin,
    direction: opts.direction ?? null,
    area: area ?? null,
  });
}

/** Безоружный удар: явная атака из листа переопределяет расчёт, иначе — общие правила. */
function unarmedStrikeEntry(
  ctx: ConnCtx,
  room: Scope['room'],
  token: Token,
  sheet: CharacterSheet | undefined
): AttackEntry {
  const explicit = findUnarmedAttack(sheet?.attacks) ?? findUnarmedAttack(token.attacks);
  const abilities = ctx.manager.abilitiesForToken(room, token) ?? {};
  return computedUnarmedStrike(explicit, {
    abilities,
    classes: sheet?.classes ?? [],
    choices: sheet?.choices,
  });
}

export function registerActionHandlers(ctx: ConnCtx) {
  const { socket, manager, isDm, syncCombat, systemMessage } = ctx;

    ctx.on('action:use', ({ mapId, tokenId, actionId, targetIds, attackIndex, advantage, slot, offhand, cleave, origin, direction }) => {
      if (!ctx.playerId || typeof actionId !== 'string') return;
      if (rejectIfReaction(ctx)) return;
      const scope = scopedToken(ctx, mapId, tokenId);
      if (!scope) return;
      const { room, token, character } = scope;
      if (rejectIfIncapacitated(ctx, token)) return;

      // «Выпутаться» (Web и подобные): действие, проверка характеристики против СЛ эффекта.
      if (actionId.startsWith('escape:')) {
        escapeEffect(ctx, scope, actionId.slice('escape:'.length), advantage);
        return;
      }

      // Действия, выданные эффектами (Expeditious Retreat: Рывок бонусным действием).
      if (actionId.startsWith('spell:')) {
        useGrantedAction(ctx, scope, actionId, { advantage, slot, origin, direction, targetIds });
        return;
      }

      // Действия зон (перемещение Moonbeam/Flaming Sphere).
      if (actionId.startsWith('zone:')) {
        useZoneAction(ctx, room, mapId, actionId, { slot, origin });
        return;
      }

      const sheet = character?.sheet;
      const classAction = sheet ? classFeatures(sheet.classes).find((a) => a.id === actionId) : undefined;
      const action: ActionDef | undefined =
        shapeStatblock(token)?.actions?.find((a) => a.id === actionId) ?? findBaseAction(actionId) ?? classAction;
      if (!action) return;

      const combat = manager.combatOf(room, mapId);
      const isActive = !combat?.active || manager.isActiveToken(room, mapId, token.id);
      // В чужой ход игрок может тратить только реакцию; DM — любые действия (как раньше).
      if (combat?.active && !isActive && !isDm() && !action.costs.includes('reaction')) {
        fail(ctx, 'notYourTurn');
        return;
      }

      const activeEntry =
        combat?.active && combat.currentIndex >= 0 ? combat.entries[combat.currentIndex] : undefined;
      const legendarySlot = !!activeEntry?.legendaryOwnerId;
      const legendaryCost = action.legendaryCost ?? 0;
      const ownedLegendary = legendaryOnly(action);
      if (legendarySlot && !ownedLegendary) {
        fail(ctx, 'legendarySlotOnly');
        return;
      }
      if (!legendarySlot && ownedLegendary) {
        fail(ctx, 'legendaryOnly');
        return;
      }
      const ownerTurn = manager.turnStateFor(room, mapId, token);
      if (action.recharge && (ownerTurn?.abilityCooldowns?.[action.id] ?? 0) > 0) {
        fail(ctx, 'recharging', { name: action.name });
        return;
      }

      // Проверки способности до списания действия: точка области и дистанция до целей.
      const abilityTargeting = actionTargeting(action);
      const abilityArea = abilityTargeting?.kind === 'area' ? abilityTargeting.area : undefined;
      const abilityOrigin = origin && Number.isFinite(origin.x) && Number.isFinite(origin.y) ? origin : null;
      if (action.ability) {
        const range = abilityTargeting?.range ?? (action.ability.attack?.rangeType === 'melee' ? 5 : 30);
        const map = manager.findMap(room, mapId);
        const grid = gridOfMap(map, room.scene.grid);
        const size = grid.size;
        if (abilityArea) {
          if (!abilityOrigin) {
            fail(ctx, 'noAreaPoint');
            return;
          }
          const feet = (Math.hypot(abilityOrigin.x - token.x, abilityOrigin.y - token.y) / size) * 5;
          if (range > 0 && feet > range) {
            fail(ctx, 'outOfRange', { feet: Math.round(feet) });
            return;
          }
          // Чистый путь до точки области (стена/закрытая дверь блокируют).
          if (map && crossesWalls(token, abilityOrigin, map.walls, 'sight')) {
            fail(ctx, 'noClearPath');
            return;
          }
        } else if (action.ability.attack) {
          for (const id of Array.isArray(targetIds) ? targetIds : []) {
            if (typeof id !== 'string') continue;
            const found = manager.findToken(room, mapId, id);
            if (!found) continue;
            const feet = gridDistanceFeet(token, found, size);
            if (range > 0 && feet > range) {
              fail(ctx, 'outOfRange', { feet: Math.round(feet) });
              return;
            }
            if (map && !tokenVisibleFrom(token, found, map.walls, grid)) {
              fail(ctx, 'noClearPath');
              return;
            }
          }
        }
      }

      const author = room.players.find((p) => p.id === ctx.playerId)?.name ?? '?';

      if (action.id === 'attack' || action.id === 'unarmedStrike') {
        // В форме зверя безоружного удара нет (действуют атаки статблока формы).
        if (action.id === 'unarmedStrike' && token.shape) {
          fail(ctx, 'noWeapon');
          return;
        }
        const index = Math.round(Number(attackIndex));
        // В форме (Wild Shape/Polymorph) оружие и атаки — из статблока зверя, не из листа.
        const attacks: AttackEntry[] = character && !token.shape ? sheet?.attacks ?? [] : shapeAttacks(token);
        const entry = action.id === 'unarmedStrike' ? unarmedStrikeEntry(ctx, room, token, sheet) : attacks[index];
        if (!entry || (action.id === 'attack' && !Number.isFinite(index))) {
          fail(ctx, 'noWeapon');
          return;
        }
        const unarmed = action.id === 'unarmedStrike' || entry.kind === 'unarmed';
        const offTurn = manager.turnStateFor(room, mapId, token);
        const offRestrictions = restrictionsFor(token.conditions, token.effects);
        let attackEntry = entry;
        let offhandNick = false;
        if (cleave) {
          // Прорубающее: вторая цель в 5 фт от цели последнего попадания и в досягаемости,
          // частью действия «Атака», раз в ход; урон без модификатора.
          const weapon = entry.weaponKey ? weaponByKey(entry.weaponKey) : undefined;
          const chosenId = targetIds?.[0];
          const from = offTurn?.cleaveFrom ? manager.findToken(room, mapId, offTurn.cleaveFrom) : null;
          const chosen = typeof chosenId === 'string' ? manager.findToken(room, mapId, chosenId) : null;
          if (
            !offTurn ||
            offTurn.cleaveUsed ||
            unarmed ||
            !weapon ||
            weapon.rangeType !== 'melee' ||
            weaponMastery(entry, sheet?.classes) !== 'Cleave' ||
            !from ||
            !chosen
          ) {
            fail(ctx, 'actionSpent');
            return;
          }
          const map = manager.findMap(room, mapId);
          const grid = gridOfMap(map, room.scene.grid);
          const betweenFeet = gridDistanceFeet(from, chosen, grid.size);
          const reachFeet = gridDistanceFeet(token, chosen, grid.size);
          if (betweenFeet > 5 || reachFeet > (entry.rangeNormal || 5)) {
            fail(ctx, 'outOfRange', { feet: Math.round(Math.max(betweenFeet, reachFeet)) });
            return;
          }
          const abilities = manager.abilitiesForToken(room, token) ?? {};
          attackEntry = {
            ...weaponAttackEntry(weapon, { abilities, classes: sheet?.classes ?? [] }, { offhand: true }),
            name: entry.name || weapon.name,
          };
        } else if (offhand) {
          // Атака второй рукой (Light): лёгкое оружие, отличное от оружия прошлой атаки;
          // Nick с доступом к мастерствам — частью действия, без бонусного.
          const weapon = entry.weaponKey ? weaponByKey(entry.weaponKey) : undefined;
          if (unarmed || !weapon || !weapon.properties.includes('L')) {
            fail(ctx, 'actionSpent');
            return;
          }
          offhandNick = weapon.mastery.includes('Nick') && masteryAccessible(sheet?.classes);
          if (offTurn) {
            const last = offTurn.lastWeaponKey ? weaponByKey(offTurn.lastWeaponKey) : undefined;
            if (!last?.properties.includes('L') || offTurn.lastWeaponKey === weapon.key) {
              fail(ctx, 'actionSpent');
              return;
            }
            if (offhandNick ? offTurn.nickUsed : !slotSpendable(offTurn, offRestrictions, 'bonus')) {
              fail(ctx, 'actionSpent');
              return;
            }
          }
          const abilities = manager.abilitiesForToken(room, token) ?? {};
          attackEntry = {
            ...weaponAttackEntry(weapon, { abilities, classes: sheet?.classes ?? [] }, { offhand: true }),
            name: entry.name || weapon.name,
          };
        } else if (!manager.canAttack(room, mapId, token, { unarmed })) {
          fail(ctx, 'actionSpent');
          return;
        }

        const targetId = targetIds?.[0];
        const target: Token | null = typeof targetId === 'string' ? manager.findToken(room, mapId, targetId) ?? null : null;
        const result = resolveWeaponAttackWithReactions(
          ctx,
          {
            attacker: token,
            attackerMapId: mapId,
            target,
            targetMapId: target ? mapId : null,
            attack: attackEntry,
            prefix: token.name,
            advantage,
            author,
          },
          {
            // Атака списывается в момент броска; ошибки до броска не тратят ресурс.
            beforeRoll: () => {
              if (cleave) {
                const turn = manager.turnStateFor(room, mapId, token);
                if (turn) {
                  if (turn.cleaveUsed) {
                    fail(ctx, 'actionSpent');
                    return false;
                  }
                  turn.cleaveUsed = true;
                  turn.cleaveFrom = undefined;
                  turn.cleaveWeapon = undefined;
                  turn.lastWeaponKey = attackEntry.weaponKey;
                }
                syncCombat(room, mapId);
                return true;
              }
              if (offhand) {
                const turn = manager.turnStateFor(room, mapId, token);
                if (turn) {
                  if (offhandNick) {
                    if (turn.nickUsed) {
                      fail(ctx, 'actionSpent');
                      return false;
                    }
                    turn.nickUsed = true;
                  } else if (!consumeSlotTurn(turn, restrictionsFor(token.conditions, token.effects), 'bonus')) {
                    fail(ctx, 'actionSpent');
                    return false;
                  }
                  turn.lastWeaponKey = attackEntry.weaponKey;
                }
                syncCombat(room, mapId);
                return true;
              }
              if (!manager.canAttack(room, mapId, token, { unarmed })) {
                fail(ctx, 'actionSpent');
                return false;
              }
              manager.consumeAttack(room, mapId, token, {
                unarmed,
                loading: weaponHasProperty(attackEntry, 'LD'),
              });
              {
                const turn = manager.turnStateFor(room, mapId, token);
                if (turn) turn.lastWeaponKey = attackEntry.weaponKey;
              }
              syncCombat(room, mapId);
              return true;
            },
          }
        );
        if (result.error) {
          socket.emit('chat:error', result.error);
          return;
        }
        return;
      }

      if (action.spellKey) {
        if (rejectIfSpellsBlocked(ctx, token)) return;
        const spell = findSpell(action.spellKey);
        if (!spell) return;
        const stats = spellStatsFor(room, token) ?? monsterStats(shapeStatblock(token), undefined);
        const input = collectSpellCast(ctx, {
          mapId,
          caster: token,
          spell,
          castLevel: spell.level,
          characterLevel: 1,
          stats,
          targetIds,
          advantage,
          origin,
          direction,
          author,
        });
        if (!input) return;
        const invalid = validateSpellCast(room, input);
        if (invalid) {
          socket.emit('chat:error', invalid);
          return;
        }
        if (legendarySlot) {
          if (!manager.spendLegendary(room, mapId, token, legendaryCost)) {
            fail(ctx, 'noLegendary');
            return;
          }
        } else {
          const turn = isActive ? manager.turnForToken(room, mapId, token) : null;
          const offTurnReaction = !!combat?.active && !isActive && action.costs.includes('reaction');
          const chosen: ActionCost = offTurnReaction ? 'reaction' : chooseSlot(turn, action.costs, slot);
          if (!manager.spendSlot(room, mapId, token, chosen)) {
            fail(ctx, offTurnReaction ? 'reactionSpent' : 'noActions');
            return;
          }
          if (legendaryCost && !manager.spendLegendary(room, mapId, token, legendaryCost)) {
            fail(ctx, 'noLegendary');
            return;
          }
        }
        if (action.recharge) manager.startAbilityCooldown(room, mapId, token, action.id, action.recharge);
        syncCombat(room, mapId);
        const result = resolveSpellCastWithReactions(ctx, input);
        if (result.error) socket.emit('chat:error', result.error);
        return;
      }

      // Прочие действия: списываем слот, дальше эффект.
      const resourceAmount = action.resourceKey ? Math.max(1, action.resourceAmount ?? 1) : 0;
      if (resourceAmount && !manager.hasResource(room, ctx.playerId, action.resourceKey!, resourceAmount)) {
        fail(ctx, 'noResource', action.resourceKey ? { key: action.resourceKey, name: action.name } : { name: action.name });
        return;
      }

      const turn = isActive ? manager.turnForToken(room, mapId, token) : null;
      const offTurnReaction = !!combat?.active && !isActive && action.costs.includes('reaction');
      if (legendarySlot) {
        if (!manager.spendLegendary(room, mapId, token, legendaryCost)) {
          fail(ctx, 'noLegendary');
          return;
        }
      } else {
        const chosen: ActionCost = offTurnReaction ? 'reaction' : chooseSlot(turn, action.costs, slot);
        if (!manager.spendSlot(room, mapId, token, chosen)) {
          fail(ctx, offTurnReaction ? 'reactionSpent' : 'noActions');
          return;
        }
        if (legendaryCost && !manager.spendLegendary(room, mapId, token, legendaryCost)) {
          fail(ctx, 'noLegendary');
          return;
        }
      }
      syncCombat(room, mapId);
      if (action.recharge) manager.startAbilityCooldown(room, mapId, token, action.id, action.recharge);

      if (resourceAmount) {
        manager.spendResource(room, ctx.playerId, action.resourceKey!, resourceAmount);
        ctx.emitResources(room, ctx.playerId);
      }

      // Автоматизированные действия (базовые/классовые) — через общий executor.
      const def = automationForAction(action, { classes: sheet?.classes }) ?? featureActionAutomation(action.id, sheet?.classes);
      if (def) {
        const targets = actionTargets(ctx, room, mapId, token, {
          area: abilityArea,
          origin: abilityOrigin,
          direction,
          targetIds,
          selfWhenEmpty: def.targeting?.kind === 'self',
        });
        // Классовые черты со спасбросками (Изгнание нежити, Сияние рассвета): СЛ из листа.
        const classKey = actionId.startsWith('class:') ? actionId.slice('class:'.length).split(/[:.]/)[0] : undefined;
        const stats = action.ability
          ? monsterStats(shapeStatblock(token), action.ability)
          : sheet && classKey
            ? casterStats(sheet, classKey)
            : null;
      executeAutomation(ctx, {
        caster: token,
        mapId,
        def: { ...def, name: action.name },
        targets,
        stats,
        author,
        advantage,
        origin: abilityOrigin,
        direction,
        area: abilityArea ?? null,
        manual: { description: action.description ? [action.description] : undefined },
      });
        return;
      }

      // Заглушки: Help/Ready/Grapple/Shove/UseObject и черты без механики.
      const summary = action.description ? firstSentence(action.description) : '';
      systemMessage(
        room,
        summary
          ? {
              code: 'actions.usedSummary',
              params: { name: token.name, action: action.name, summary },
            }
          : { code: 'actions.used', params: { name: token.name, action: action.name } }
      );
    });
}

