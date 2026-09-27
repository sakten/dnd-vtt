import {
  areaContainsPoint,
  attackRollParts,
  autoCrit,
  collectAttackSources,
  combineRollParts,
  d20Expr,
  damageRollParts,
  exhaustionRollPenalty,
  gridDistanceFeet,
  gridOfMap,
  hostileTokens,
  isBanished,
  isSurrounded,
  resolveAttack,
  rollDice,
  saveNoDamage,
  seesInvisible,
  sideMatches,
  sourcesCounts,
  takenDamageParts,
  tokensNearFeet,
  withRollParts,
  type AttackBurst,
  type AutomationDef,
  type AutomationEffect,
  type AutomationUtility,
  type DiceRollResult,
  type SpellStats,
  type Token,
} from 'shared';
import type { ConnCtx } from '../context';
import type { Room } from '../../roomTypes';
import { gridSizeOfMap } from '../../rooms';
import { creatureTypeOf } from '../../room/actor';
import { applyDamage, singleDamageType } from '../damage';
import { attackDamageRoll, attackHitRoll, attackUnseen, type WeaponDamageMods } from '../attackResolve';
import { fail } from '../errors';
import { removeConditionInstances } from '../effectsApply';
import { applyForcedMovement } from '../force';
import { executeTeleport } from '../teleport';
import { emitSpellFx } from '../fx';
import { pushRollMessage } from '../messages';
import { misdirectCheck } from '../misdirect';
import { openAttackHitWindows, openAttackMissWindows, offerDamageReactions } from '../reactions/windows';
import { openRedirectWindow } from '../reactions/features';
import { maybeRollAnim } from '../rollAnim';
import { runSummon, familiarCannotAttack } from '../summons';
import { applyPolymorphForm } from '../forms';
import { applyWallPush, createZoneFromDef } from '../zones';
import {
  anchorConcentration,
  applyEffectLight,
  applyMaxHpFromDamage,
  applyResult,
  applyTargetEffects,
  dropConcentration,
  lifeHealing,
  proficiencyFor,
  resolveDiceExpression,
  tokensAround,
  withSpellAbilityMod,
  type AutomationInput,
  type AutomationRun,
} from './core';
import { dispatchKind } from './dispatch';
import {
  applyDefEffects,
  applyUtility,
  openSaveInspiration,
  rollTargetSaveFor,
  type TargetSave,
} from './handlers';

/**
 * Всплеск вокруг цели: спас и урон по всем существам в радиусе (Ice Knife —
 * независимо от попадания; Hail of Thorns/Lightning Arrow — райдер смайта).
 */
export function runBurst(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  attacker: Token,
  center: Token,
  source: { key: string; name: string },
  burst: AttackBurst,
  stats: SpellStats | null,
  author: string
): void {
  const save = burst.save;
  if (!save) return;
  const map = ctx.manager.findMap(room, mapId);
  if (!map) return;
  const grid = gridOfMap(map, room.scene.grid);
  const targets = tokensNearFeet(map.tokens, center, burst.rangeFeet, grid.size).filter(
    (t) => (burst.includePrimary === true || t.id !== center.id) && !isBanished(t)
  );
  if (!targets.length) return;
  const def: AutomationDef = {
    key: source.key,
    name: source.name,
    resolution: 'save',
    save: { ability: save.ability, half: save.half !== false },
    ...(burst.dice ? { damage: { dice: burst.dice, types: [burst.damageType] } } : {}),
  };
  executeAutomation(ctx, { caster: attacker, mapId, def, targets, stats, author });
}

/**
 * Thunder Step: спас и урон по существам у покинутой точки (после телепорта).
 * `departure` — подошва кастера до перемещения (мутируется `executeTeleport`).
 */
function applyLeavingBurst(
  ctx: ConnCtx,
  room: Room,
  input: AutomationInput,
  burst: NonNullable<AutomationUtility['fromBurst']>,
  departure: { x: number; y: number; w: number; h: number }
): void {
  const map = ctx.manager.findMap(room, input.mapId);
  if (!map) return;
  const grid = gridOfMap(map, room.scene.grid);
  const targets = tokensNearFeet(map.tokens, departure, burst.feet, grid.size).filter((t) => !isBanished(t));
  if (!targets.length) return;
  const def: AutomationDef = {
    key: input.def.key,
    name: input.def.name,
    resolution: 'save',
    save: burst.save,
    ...(burst.damage ? { damage: burst.damage } : {}),
  };
  executeAutomation(ctx, { ...input, def, targets });
}

/** Атака заклинанием (лучи/снаряды): попадание, урон, эффекты на попадании. `true` — бросок атаки состоялся. */
function runWeaponAttacks(run: AutomationRun, stats: SpellStats): boolean {
  const { ctx, room, def, caster, mapId, targets, author, abilities, expression, subject, damageType, adv, count } = run;
  if (!def.attack) return false;
  const { rangeType, advantageInZone } = def.attack;
  const castMap = ctx.manager.findMap(room, mapId);
  const gridSize = castMap ? gridSizeOfMap(castMap) : 50;
  const penalty = exhaustionRollPenalty(caster.conditions);
  // Число атак: у целевых заклинаний (Steel Wind Strike, `def.targets`) — одна атака
  // на выбранную цель; у снарядов (Eldritch Blast) — `count`, как раньше.
  const rays = def.targets ? Math.min(count, Math.max(1, targets.length)) : count;

  /** Конец последовательности: телепорт после атак (Steel Wind Strike). */
  let finished = false;
  /** Был ли хотя бы один бросок атаки (для действий, привязанных к выстрелу: луч Wall of Light). */
  let rolled = false;
  const finishSequence = () => {
    if (finished) return;
    finished = true;
    if (run.teleportTo) executeTeleport(ctx, room, mapId, caster, run.teleportTo);
  };

  /**
   * Каждый луч/снаряд бьёт свою цель (если задана), иначе — последнюю/первую.
   * Окна реакций приостанавливают резолв, поэтому лучи — рекурсивная
   * последовательность: следующий запускается из resume окна.
   */
  const resolveRay = (i: number): void => {
    if (i >= rays) return finishSequence();
    const target = targets[i] ?? targets[targets.length - 1] ?? targets[0];
    if (!target) return resolveRay(i + 1);
    const label = rays > 1 ? `${subject} (${i + 1}/${rays})` : subject;
    const effectCtx = { rangeType, attackType: rangeType, attackerType: creatureTypeOf(room, caster) } as const;
    const effectParts = attackRollParts(caster.effects, target.effects, effectCtx, abilities);
    // Состояния/невидимость и авто-крит — как в оружейной атаке (общие ядра attackResolve).
    const unseen = castMap ? attackUnseen(room, caster, target, castMap) : undefined;
    const distance = castMap ? gridDistanceFeet(caster, target, gridSize) : 0;
    // Опциональное правило «Окружение»: преимущество смежным врагам окружённой цели.
    const surrounded =
      !!castMap &&
      room.optionalRules.surrounded &&
      distance <= 5 &&
      hostileTokens(caster, target) &&
      isSurrounded({
        target,
        tokens: castMap.tokens,
        grid: { size: gridSize, offsetX: castMap.grid.offsetX, offsetY: castMap.grid.offsetY },
        walls: castMap.walls,
        bounds: { width: castMap.width, height: castMap.height },
      });
    const sources = collectAttackSources({
      explicit: adv,
      attackerConditions: caster.conditions,
      targetConditions: target.conditions,
      rangeType,
      effectMode: effectParts.mode,
      attackerEffects: caster.effects,
      targetEffects: target.effects,
      effectContext: effectCtx,
      abilities,
      includeTarget: true,
      unseenTarget: unseen?.unseenTarget,
      unseenAttacker: unseen?.unseenAttacker,
      surrounded,
      attackerSeesInvisible: seesInvisible(caster.effects),
      targetSeesInvisible: seesInvisible(target.effects),
    });
    // Storm Sphere: цель внутри сферы-источника действия — преимущество броска атаки.
    if (advantageInZone && run.zoneId && castMap) {
      const zone = castMap.zones?.find((z) => z.id === run.zoneId);
      const areaGrid = { size: gridSize, offsetX: castMap.grid.offsetX, offsetY: castMap.grid.offsetY };
      if (zone && areaContainsPoint(zone.area, zone.origin, zone.direction ?? null, target, areaGrid)) {
        sources.push({ side: 'advantage', kind: 'rule', key: 'insideZone' });
      }
    }
    const { advantage, disadvantage } = sourcesCounts(sources);
    const ac = ctx.manager.acForToken(room, target);
    const hit = attackHitRoll({
      attackExpr: withRollParts(d20Expr(stats.attack), { flat: effectParts.flat, dice: effectParts.dice }),
      advCount: advantage,
      disCount: disadvantage,
      penalty,
      critMin: 20,
      targetAc: ac,
      autoCrit: autoCrit(target.conditions, distance, rangeType),
    });
    rolled = true;
    pushRollMessage(ctx, room, {
      author,
      roll: hit.hitRoll,
      kind: 'attack',
      params: {
        subject: label,
        hit: hit.hitSuccess ? 'hit' : 'miss',
        penalty: penalty || undefined,
        sources: sources.length ? sources : undefined,
      },
    });
    // Лучи/снаряды: анимируем d20 только для первого, иначе анимации перебивают друга.
    if (rays === 1 || i === 0) maybeRollAnim(ctx, hit.hitRoll);

    const windowPlan = { attacker: caster, attackerMapId: mapId, target, targetMapId: mapId, damageType, rangeType };
    const nextRay = () => resolveRay(i + 1);
    /** После броска луча: взрыв осколка (Ice Knife) — и следующий луч. */
    const afterRay = () => {
      if (def.burst) runBurst(ctx, room, mapId, caster, target, def, def.burst, stats, author);
      nextRay();
    };
    /** Промах: Melf's Acid Arrow брызжет половиной первичного урона. */
    const afterMiss = () => {
      if (def.halfOnMiss && expression) {
        applyResult(run, target, rollDice(expression), { halve: true, subject: label });
      }
      afterRay();
    };

    /** Урон и эффекты луча; выполняется после окон (промах мог стать попаданием). */
    const applyRayHit = (mods: WeaponDamageMods, done: () => void) => {
      // Mirror Image: попадание может принять образ вместо цели.
      if (misdirectCheck(ctx, room, mapId, target, caster)) return done();
      let damageRoll: DiceRollResult | undefined;
      if (expression) {
        const damageParts = combineRollParts([
          damageRollParts(caster.effects, { rangeType, attackType: rangeType, damageType, targetId: target.id }, abilities),
          // Доп. урон по цели от атак кастера (Spirit Shroud: цель под аурой).
          takenDamageParts(target.effects, caster.id),
        ]);
        damageRoll = attackDamageRoll(expression, damageParts, hit.crit);
      }
      const applied = damageRoll
        ? applyResult(run, target, damageRoll, { subject: label, crit: hit.crit, mods })
        : undefined;
      // Отражение атак: удар полностью погашен — окно перенаправления.
      if (damageRoll && mods.redirect && damageRoll.total <= (mods.flatReduction ?? 0)) {
        openRedirectWindow(
          ctx,
          room,
          mapId,
          { attacker: caster, attack: { rangeType, damageType } },
          mods.redirect,
          { onDone: done }
        );
        return;
      }
      if (applied?.applied) {
        offerDamageReactions(ctx, room, mapId, target, caster, { amount: applied.amount, damageType });
      }
      if (def.save && def.effects?.length) {
        const save = rollTargetSaveFor(ctx, room, def, author, target, stats, def.save.ability);
        if (save.success) return done();
      }
      applyTargetEffects(run, target, stats);
      if (def.force) applyForcedMovement(ctx, room, mapId, caster, target, def.force);
      done();
    };

    /** Окно попадания: Shield/Absorb/Отражение/Режущие слова; onDone — попадание после реакций. */
    const withHitWindows = (total: number, onDone: (ok: boolean, mods?: WeaponDamageMods) => void) => {
      if (!castMap) return onDone(true);
      const opened = openAttackHitWindows(ctx, room, windowPlan, { ac, total, melee: rangeType !== 'ranged' }, (mods) => {
        if (!ctx.getRoom()) return;
        // Shield/Парирование: AC мог вырасти после реакций — пересчитываем попадание.
        const acNow = ctx.manager.acForToken(room, target) + (mods.extraAc ?? 0);
        onDone(resolveAttack(total, hit.crit, false, acNow), mods);
      });
      if (!opened) onDone(true);
    };

    // Промах: окно реакций (Направленный удар +10, кости вдохновения).
    if (hit.hitSuccess === false) {
      const opened = openAttackMissWindows(ctx, room, windowPlan, ({ bonus, inspiration }) => {
        if (!ctx.getRoom()) return;
        const total = hit.hitRoll.total + penalty + bonus + inspiration;
        if (bonus + inspiration <= 0 || !resolveAttack(total, hit.crit, false, ac)) return afterMiss();
        withHitWindows(total, (ok, mods) => {
          if (ok) applyRayHit(mods ?? {}, afterRay);
          else afterMiss();
        });
      });
      if (opened) return;
      return afterMiss();
    }

    // Попадание: окно защитных реакций цели и защитников-союзников.
    withHitWindows(hit.hitRoll.total + penalty, (ok, mods) => {
      if (ok) applyRayHit(mods ?? {}, afterRay);
      else afterRay();
    });
  };

  resolveRay(0);
  return rolled;
}

/** Способность без атаки и сейва: урон и эффекты срабатывают сразу. */
function runAutoAbility(run: AutomationRun, stats: SpellStats | null): void {
  const { targets, expression } = run;
  for (const target of targets) {
    if (expression) applyResult(run, target, rollDice(expression));
    applyTargetEffects(run, target, stats);
  }
}

/** Божественная искра: союзник лечится, враждебная цель — спасбросок и урон (половина при успехе). */
function runHealOrDamage(run: AutomationRun, stats: SpellStats): void {
  const { def, caster, targets, abilities, proficiency } = run;
  if (!def.save || !def.heal || !def.damage) return;
  const healExpr = resolveDiceExpression(def.heal, abilities, proficiency);
  const damageExpr = resolveDiceExpression(def.damage, abilities, proficiency);
  for (const target of targets) {
    const hostile = hostileTokens(caster, target);
    const targetExpr = hostile ? damageExpr : healExpr;
    if (!targetExpr) continue;
    const roll = rollDice(targetExpr);
    let halve: boolean | undefined;
    if (hostile) {
      const save = rollTargetSaveFor(run.ctx, run.room, def, run.author, target, stats, def.save.ability);
      if (save.success && (!def.save.half || saveNoDamage(target.effects))) continue;
      halve = save.success && !saveNoDamage(target.effects);
    }
    applyResult(run, target, roll, { kind: hostile ? 'damage' : 'heal', ...(halve !== undefined && { halve }) });
  }
}

/** Life Transference: кастер получает неуменьшаемый урон, цель лечится на долю от него. */
function runLifeTransfer(run: AutomationRun): void {
  const { ctx, room, def, caster, mapId, targets, expression, author } = run;
  if (!expression) return;
  const factor = def.lifeTransfer?.factor ?? 2;
  const roll = rollDice(expression);
  pushRollMessage(ctx, room, {
    author,
    roll,
    kind: 'damage',
    params: { subject: `${def.name}: ${caster.name}`, damageType: run.damageType },
  });
  const self = applyDamage(ctx, {
    target: caster,
    mapId,
    amount: roll.total,
    damageType: run.damageType,
    unreducible: true,
  });
  const heal = Math.max(0, Math.round(self.amount * factor));
  for (const target of targets) {
    if (heal <= 0) continue;
    // Лечение — обычной картой в чате (не системной строкой).
    applyDamage(ctx, {
      target,
      mapId,
      amount: heal,
      kind: 'heal',
      roll: rollDice(String(heal)),
      author,
      params: { subject: `${def.name}: ${caster.name} → ${target.name}` },
    });
  }
}

/** Спасбросок по площади: один бросок урона, половина при успехе; эффекты — при провале. */
function runSave(run: AutomationRun, stats: SpellStats): void {
  const { ctx, room, def, caster, targets, abilities, expression } = run;
  if (!def.save) return;
  // Enervation: успех — отдельный бросок `successDamage` (не половина общего).
  const successExpr = def.successDamage ? resolveDiceExpression(def.successDamage, abilities, run.proficiency) : null;
  const rollParts = damageRollParts(caster.effects, { damageType: run.damageType }, abilities);
  // Один бросок урона на всё заклинание (5e: AoE кидает урон один раз). При
  // `successDamage` бросок свой на каждую цель: успех и провал — разные кости.
  let damageRoll: DiceRollResult | null = null;
  // Пустая область (некого бить) — урон не бросаем и карточку не сыпем.
  if (expression && !successExpr && targets.length > 0) {
    damageRoll = rollDice(withRollParts(expression, rollParts));
    pushRollMessage(ctx, room, {
      author: run.author,
      roll: damageRoll,
      kind: run.healing ? 'heal' : 'damage',
      params: { subject: run.subject, damageType: run.damageType },
    });
  }
  // Negative Energy Flood: нежить спас не бросает — вместо урона получает половину броска врем. хитами.
  const undeadIds = def.undeadTempHp
    ? new Set(targets.filter((t) => creatureTypeOf(room, t) === 'undead').map((t) => t.id))
    : new Set<string>();
  const saves: TargetSave[] = [];
  const half = def.save.half;
  const combatAdvantage = !!def.saveAdvantageInCombat && ctx.manager.combatOf(room, run.mapId)?.active === true;
  for (const target of targets) {
    if (undeadIds.has(target.id)) continue;
    const save = rollTargetSaveFor(run.ctx, run.room, def, run.author, target, stats, def.save.ability, combatAdvantage);
    saves.push(save);
  }
  const applyAll = () => {
    let shaped = false;
    if (damageRoll && undeadIds.size) {
      for (const target of targets) {
        if (!undeadIds.has(target.id)) continue;
        const amount = Math.floor(damageRoll.total / 2);
        if (amount <= 0) continue;
        run.ctx.manager.grantTempHp(run.room, target, amount);
        const cid = run.ctx.manager.controllerOfToken(run.room, target);
        if (cid) run.ctx.emitResources(run.room, cid);
        run.ctx.emitToken(run.room, 'token:update', run.mapId, target);
        run.ctx.systemMessage(run.room, {
          code: 'automation.tempHp',
          params: { name: run.caster.name, feature: def.name, targets: `${target.name} +${amount} врем. HP` },
        });
      }
    }
    for (const save of saves) {
      if (!save.success) applyTargetEffects(run, save.target, stats);
      // Polymorph: провалившийся сейв превращается в выбранного зверя (концентрация — до конца).
      if (run.def.shape && !save.success) {
        shaped = applyPolymorphForm(run.ctx, run.room, run.mapId, run.caster, save.target, run.shapeForm, run.def.key) || shaped;
      }
      if (run.def.force && !save.success) {
        applyForcedMovement(run.ctx, run.room, run.mapId, run.caster, save.target, run.def.force);
      }
      if (!damageRoll && !successExpr) continue;
      if (save.success && saveNoDamage(save.target.effects)) continue;
      if (successExpr) {
        const expr = save.success ? successExpr : expression;
        if (!expr) continue;
        const roll = rollDice(withRollParts(expr, rollParts));
        pushRollMessage(ctx, room, {
          author: run.author,
          roll,
          kind: 'damage',
          params: { subject: `${run.subject} · ${save.target.name}`, damageType: run.damageType },
        });
        applyResult(run, save.target, roll, { silent: true });
        continue;
      }
      if (save.success && !half) continue;
      const result = applyResult(run, save.target, damageRoll!, { halve: save.success, silent: true });
      // Harm: провал спасброска снижает максимум HP на фактически полученный урон.
      if (def.maxHpFromDamage && !save.success && result.applied && result.amount > 0) {
        applyMaxHpFromDamage(run, save.target, result.amount);
      }
    }
    // Self-эффекты «только при провале» (Enervation: повтор действием).
    const failed = saves.some((save) => !save.success);
    const onFailSelf = (def.effects ?? []).filter((e) => e.to === 'self' && e.selfOnFail);
    if (failed && onFailSelf.length) {
      for (const effectDef of onFailSelf) {
        applyEffectLight(run.ctx, run.room, run.mapId, {
          sourceKey: def.key,
          sourceId: caster.id,
          mapId: run.mapId,
          effectDef,
          target: caster,
          maxRounds: def.maxRounds,
          untilSaveDc: stats.dc,
          escapeDc: stats.dc,
        });
      }
      if (def.concentration) anchorConcentration(run.ctx, run.room, caster, run.mapId, def);
    }
    // Форма — не эффект: якорь концентрации на кастере нужен для проверки уроном и снятия.
    if (run.def.concentration && shaped) anchorConcentration(run.ctx, run.room, run.caster, run.mapId, run.def);
  };
  if (openSaveInspiration(ctx, room, run.mapId, stats.dc, def.name, saves, applyAll)) return;
  applyAll();
}

/** Массовая цель без области (Mass Healing Word): каждая выбранная цель — один раз. */
function runMultiTarget(run: AutomationRun): void {
  const { def, targets, expression } = run;
  if (!def.targets || !expression) return;
  for (const target of targets.slice(0, Math.max(1, def.targets))) {
    applyResult(run, target, rollDice(expression));
  }
}

/** Одиночная цель (или повтор той же): по броску урона/лечения на цель. */
function runSingleTargets(run: AutomationRun): void {
  const { targets, subject, expression, count } = run;
  if (!expression) return;
  for (let i = 0; i < count; i++) {
    const target = targets[i] ?? targets[targets.length - 1] ?? targets[0];
    if (!target) continue;
    const label = count > 1 ? `${subject} (${i + 1}/${count})` : subject;
    applyResult(run, target, rollDice(expression), { subject: label });
  }
}

export function executeAutomation(ctx: ConnCtx, input: AutomationInput): { attackRolled?: boolean } | undefined {
  const room = ctx.getRoom();
  if (!room) return;
  const { caster, def, mapId, stats, author } = input;
  // Черты без выбора целей (Изгнание нежити): цели собираются по радиусу от кастера.
  const rawTargets = def.autoTargets
    ? tokensAround(
        ctx,
        room,
        mapId,
        caster,
        def.autoTargets.feet,
        def.autoTargets.side,
        def.autoTargets.includeSelf === true
      )
    : input.targets;
  // Фильтр по отношению к кастеру (Conjure Woodland Beings: только враги).
  const sided = def.side ? rawTargets.filter((t) => sideMatches(caster, t, def.side!)) : rawTargets;
  // Типы-исключения (Command: нежить) — такие цели пропускаются, каст может уйти впустую.
  const targets = def.excludeCreatureTypes?.length
    ? sided.filter((t) => !def.excludeCreatureTypes!.includes(creatureTypeOf(room, t) ?? ''))
    : sided;

  const abilities = ctx.manager.abilitiesForToken(room, caster);
  const proficiency = proficiencyFor(ctx, room, caster);
  const expression = withSpellAbilityMod(resolveDiceExpression(def.damage ?? def.heal, abilities, proficiency), def, stats);
  const kind = dispatchKind(def, { hasStats: !!stats, hasExpression: !!expression });

  if (kind === 'utility') {
    // Thunder Step: вспышка в покинутой точке — сразу после телепорта кастера/пассажира.
    const leavingBurst = def.utility?.kind === 'teleport' ? def.utility.fromBurst : undefined;
    const departure = leavingBurst ? { x: caster.x, y: caster.y, w: caster.w, h: caster.h } : null;
    applyUtility(ctx, { ...input, targets });
    // Far Step: телепорт при касте + выданное бонусное действие (эффект на кастера).
    if (def.effects?.length) applyDefEffects(ctx, { ...input, targets });
    if (leavingBurst && departure) applyLeavingBurst(ctx, room, input, leavingBurst, departure);
    return;
  }

  // Фамильяр (Find Familiar) не атакует без Pact of the Chain — ни оружием, ни способностью.
  if (def.attack && familiarCannotAttack(caster)) {
    fail(ctx, 'familiarNoAttack', { name: caster.name });
    return;
  }

  // Косметический эффект применения: клиент рисует по этому событию (в т.ч. зоны/ауры).
  emitSpellFx(
    ctx,
    {
      caster,
      mapId,
      def,
      origin: input.origin ?? null,
      direction: input.direction ?? null,
      area: input.area ?? def.area ?? null,
    },
    targets
  );

  // Новая концентрация: прошлые эффекты и зоны снимаются до создания новой зоны.
  if (def.concentration) dropConcentration(ctx, room, caster);

  // Призыв: спавн токенов по шаблону каталога (скейл круга/кастера, владелец-контролёр).
  if (kind === 'summon' && def.summon) {
    runSummon(ctx, {
      caster,
      mapId,
      level: def.summon.level ?? input.manual?.castLevel ?? 1,
      def: def.summon,
      stats,
      origin: input.origin ?? null,
      ...(input.summonKey ? { summonKey: input.summonKey } : {}),
      spellKey: def.key,
    });
    if (def.concentration) anchorConcentration(ctx, room, caster, mapId, def);
    return;
  }

  // Зона создаётся независимо от мгновенного payload'а (спас/урон/эффекты — сразу).
  // Для ауры на источнике и зон «в своей клетке» (Cordon) точка берётся с кастера.
  const zoneOrigin =
    input.origin ??
    (def.zone?.anchor === 'source' || def.zone?.origin === 'self' ? { x: caster.x, y: caster.y } : null);
  // Тонкая стена при появлении выталкивает разрезанных существ на выбранную сторону (до зоны).
  if (def.zone?.wall && zoneOrigin) {
    applyWallPush(ctx, room, caster, mapId, def.zone, {
      path: input.path,
      origin: input.origin,
      direction: input.direction,
      side: input.pushSide ?? undefined,
    });
  }
  if (def.zone && zoneOrigin) {
    createZoneFromDef(ctx, { caster, mapId, def, stats, origin: zoneOrigin, direction: input.direction, path: input.path });
  }

  if (kind === 'effect') {
    applyDefEffects(ctx, { ...input, targets });
    // Снятие состояний при касте (Protection from Poison): независимо от эффекта.
    if (def.endConditions?.length) {
      for (const target of targets) removeConditionInstances(ctx, room, mapId, target, def.endConditions);
    }
    return;
  }

  // Self-эффекты не-effect резолвов (Vampiric Touch, Sunbeam, Conjure Woodland Beings):
  // один раз на кастера + якорь концентрации (зоны/эффекты живут до её снятия).
  // `selfOnFail` (Enervation) — отложены до провала спасброска в runSave.
  const selfEffects = (def.effects ?? []).filter((e) => e.to === 'self' && !e.selfOnFail);
  if (selfEffects.length) {
    for (const effectDef of selfEffects) {
      applyEffectLight(ctx, room, mapId, {
        sourceKey: def.key,
        sourceId: caster.id,
        mapId,
        effectDef,
        target: caster,
        maxRounds: def.maxRounds,
        untilSaveDc: stats?.dc,
        escapeDc: stats?.dc,
      });
    }
    if (def.concentration) anchorConcentration(ctx, room, caster, mapId, def);
  }

  // Зонная концентрация: якорь на кастере, если его ещё нет (self-эффекты ставят выше).
  // Без этого зона с целевыми эффектами (Web, Wall of Light) гасла при первом движении.
  if (def.zone && def.concentration && !caster.effects.some((e) => e.concentration && e.sourceKey === def.key)) {
    anchorConcentration(ctx, room, caster, mapId, def);
  }

  const run: AutomationRun = {
    ctx,
    room,
    caster,
    def,
    mapId,
    targets,
    author,
    abilities,
    proficiency,
    // Ученик жизни / Целитель-благословенный: бонус к лечению заклинанием с ячейкой.
    healing: !!def.heal,
    healMods: lifeHealing(room, caster, def, input.manual?.castLevel),
    expression,
    subject: `${caster.name} — ${def.name}`,
    adv: input.advantage === 'a' || input.advantage === 'd' ? input.advantage : undefined,
    damageType: singleDamageType(def.damage?.types),
    count: Math.max(1, def.count ?? 1),
    ...(input.summonKey ? { shapeForm: input.summonKey } : {}),
    ...(input.zoneId ? { zoneId: input.zoneId } : {}),
    ...(def.teleportAfter && input.origin ? { teleportTo: input.origin } : {}),
  };

  if (kind === 'lifeTransfer') {
    runLifeTransfer(run);
    return;
  }
  if (kind === 'attack') return { attackRolled: runWeaponAttacks(run, stats!) };
  if (kind === 'healOrDamage') {
    runHealOrDamage(run, stats!);
    return;
  }
  if (kind === 'save') {
    runSave(run, stats!);
    return;
  }
  if (kind === 'auto') {
    runAutoAbility(run, stats);
    return;
  }

  if (kind === 'manual') {
    // Ручные спеллы «ведёт мастер» (Charm Monster/Compulsion): каст вешает плашку;
    // действия направления — скрытым эффектом на кастере (концентрация — на нём же).
    if (def.byDesign && targets.length) {
      const chipEffect: AutomationEffect = {
        name: def.name,
        duration: def.concentration ? { type: 'concentration' } : { type: 'permanent' },
        ...(def.concentration ? { concentration: true } : {}),
        to: 'targets',
        modifiers: [],
        ...(def.chip ? { conditions: [def.chip] } : {}),
      };
      for (const target of targets) {
        applyEffectLight(ctx, room, mapId, {
          sourceKey: def.key,
          sourceId: caster.id,
          mapId,
          effectDef: chipEffect,
          target,
        });
      }
      let anchorId: string | undefined;
      if (def.chipActions?.length) {
        anchorId = applyEffectLight(ctx, room, mapId, {
          sourceKey: def.key,
          sourceId: caster.id,
          mapId,
          effectDef: {
            name: def.name,
            duration: def.concentration ? { type: 'concentration' } : { type: 'permanent' },
            ...(def.concentration ? { concentration: true } : {}),
            to: 'self',
            modifiers: [],
            actions: def.chipActions,
            hidden: true,
          },
          target: caster,
        });
      }
      if (def.concentration) {
        if (anchorId) ctx.manager.setConcentration(room, mapId, caster, anchorId);
        else anchorConcentration(ctx, room, caster, mapId, def);
      }
    }
    if (def.zone) return; // зона уже создана; отдельного сообщения не нужно
    const level = input.manual?.level;
    const detail = input.manual?.description?.[0] ? `\n${input.manual.description[0]}` : '';
    const params = { name: caster.name, feature: def.name, detail };
    if (level === undefined) ctx.systemMessage(room, { code: 'automation.manual', params });
    else if (level === 0) ctx.systemMessage(room, { code: 'automation.manualCantrip', params });
    else
      ctx.systemMessage(room, {
        code: 'automation.manualLevel',
        params: { ...params, level: input.manual?.castLevel ?? level },
      });
    return;
  }

  if (kind === 'multi') {
    runMultiTarget(run);
    return;
  }
  runSingleTargets(run);
}
