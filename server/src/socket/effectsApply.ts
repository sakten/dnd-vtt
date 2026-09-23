import { randomUUID } from 'node:crypto';
import {
  isIncapacitated,
  sheetProficiencyBonus,
  type AutomationEffect,
  type ConditionKey,
  type EffectInstance,
  type Token,
} from 'shared';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';
import { endShapeToken } from './forms';

export interface ApplyEffectArgs {
  sourceKey: string;
  sourceId: string;
  mapId: string;
  effectDef: AutomationEffect;
  target: Token;
  markedId?: string;
  /** СЛ повторного спасброска для `untilSave`-эффектов (Sleep и т.п.). */
  untilSaveDc?: number;
  /** СЛ выпутывания действием (`effectDef.escape`). */
  escapeDc?: number;
  /** Зона-источник (аура): эффект снимается при выходе и окончании зоны. */
  zoneId?: string;
}

/** Накладывает один эффект на токен (заменяя прошлый каст того же источника). */
export function applyEffectTo(ctx: ConnCtx, room: Room, args: ApplyEffectArgs): string {
  const { sourceKey, sourceId, mapId, effectDef, target, markedId, untilSaveDc, escapeDc, zoneId } = args;
  // Концентрацию не заменяем: её жизненным циклом управляет clearConcentration
  // (иначе аура зоны, попавшая на своего кастера, снимает якорь концентрации).
  for (const stale of target.effects.filter(
    (e) => e.sourceKey === sourceKey && e.sourceId === sourceId && !e.concentration
  )) {
    ctx.manager.removeEffect(room, target, stale.id);
  }
  const effectId = randomUUID();
  let duration = effectDef.duration;
  if (duration.type === 'untilSave' && untilSaveDc !== undefined) duration = { ...duration, dc: untilSaveDc };
  // Skill Empowerment: `$proficiency` = ПБ носителя (экспертиза); при уже имеющейся
  // экспертизе по навыку модификатор не дублируется (RAW).
  const controllerId = ctx.manager.controllerOfToken(room, target);
  const sheet = controllerId ? room.sheets[controllerId] : undefined;
  const modifiers: EffectInstance['modifiers'] = [];
  effectDef.modifiers.forEach((m, i) => {
    let value = m.value;
    if (value === '$proficiency') {
      if (sheet && m.filter?.skill && sheet.skills[m.filter.skill] === 2) return;
      // ПБ листа может быть числом или костью (домашнее правило): берём как есть.
      const raw = sheet?.proficiencyBonus?.trim() ?? '';
      value = raw
        ? /^\d+$/.test(raw)
          ? Number(raw)
          : raw
        : sheet
          ? sheetProficiencyBonus(sheet)
          : 2;
    }
    modifiers.push({
      ...m,
      value,
      id: `${effectId}:m${i}`,
      ...(markedId ? { filter: { ...m.filter, targetId: markedId } } : {}),
    });
  });
  const effect: EffectInstance = {
    id: effectId,
    name: effectDef.name,
    sourceKey,
    sourceId,
    concentration: effectDef.concentration,
    duration,
    modifiers,
    conditions: effectDef.conditions,
    escalate: effectDef.escalate,
    wakeOnDamage: effectDef.wakeOnDamage,
    saveOnDamage: effectDef.saveOnDamage,
    restrictions: effectDef.restrictions,
    zoneId,
    escape: effectDef.escape
      ? { ...effectDef.escape, dc: escapeDc ?? effectDef.escape.dc ?? 10 }
      : undefined,
    // Sanctuary: СЛ спасброска атакующего — СЛ каста (передаётся как untilSaveDc).
    sanctuary: effectDef.sanctuary ? { dc: untilSaveDc ?? 10 } : undefined,
    misdirect: effectDef.misdirect ? { ...effectDef.misdirect } : undefined,
    hidden: effectDef.hidden,
    bonusDie: effectDef.bonusDie,
    bonusDieUses: effectDef.bonusDieUses ? [...effectDef.bonusDieUses] : undefined,
    senses: effectDef.senses ? [...effectDef.senses] : undefined,
    actions: effectDef.actions,
    variant: effectDef.variant,
    mark: effectDef.mark,
    light: effectDef.light ? { ...effectDef.light } : undefined,
    deathWard: effectDef.deathWard,
    magicWeapon: effectDef.magicWeapon,
    damageLink: effectDef.damageLink ? { tokenId: sourceId } : undefined,
    conditionImmunities: effectDef.conditionImmunities ? [...effectDef.conditionImmunities] : undefined,
    conditionImmunitiesFrom: effectDef.conditionImmunitiesFrom
      ? {
          conditions: [...effectDef.conditionImmunitiesFrom.conditions],
          types: [...effectDef.conditionImmunitiesFrom.types],
        }
      : undefined,
    triggers: effectDef.triggers
      ? { ...(effectDef.triggers.startOfTurn ? { startOfTurn: { ...effectDef.triggers.startOfTurn } } : {}) }
      : undefined,
    immuneToSpeedReduction: effectDef.immuneToSpeedReduction,
    ignoresDifficultTerrain: effectDef.ignoresDifficultTerrain,
    seesInvisible: effectDef.seesInvisible,
    maximizeHealing: effectDef.maximizeHealing,
    deathSaveAdvantage: effectDef.deathSaveAdvantage,
    saveNoDamage: effectDef.saveNoDamage,
    retaliate: effectDef.retaliate ? { ...effectDef.retaliate } : undefined,
    ward: effectDef.ward ? [...effectDef.ward] : undefined,
    breakOn: effectDef.breakOn ? [...effectDef.breakOn] : undefined,
  };
  ctx.manager.applyEffect(room, target, effect);
  // Wild Shape/Polymorph оканчиваются от недееспособности (XPHB).
  if (target.shape && isIncapacitated(target.conditions)) {
    endShapeToken(ctx, room, mapId, target);
  }
  if (effectDef.tempHp) {
    ctx.manager.grantTempHp(room, target, effectDef.tempHp);
    const controllerId = ctx.manager.controllerOfToken(room, target);
    if (controllerId) ctx.emitResources(room, controllerId);
  }
  ctx.emitToken(room, 'token:update', mapId, target);
  return effectId;
}

/**
 * Снимает с токена состояния по ключам (Heal/Lesser/Greater Restoration):
 * состояние снимается вместе с эффектом-источником, у концентрации проверяется якорь.
 * Возвращает имена снятых состояний.
 */
export function removeConditionInstances(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  token: Token,
  keys: ConditionKey[]
): string[] {
  const wanted = new Set(keys);
  const removed = token.conditions.filter((c) => wanted.has(c.key));
  if (!removed.length) return [];
  const effectIds = new Set(removed.map((c) => c.effectId).filter((id): id is string => !!id));
  const removedEffects: EffectInstance[] = [];
  for (const id of effectIds) {
    const effect = token.effects.find((e) => e.id === id);
    if (effect && ctx.manager.removeEffect(room, token, id)) removedEffects.push(effect);
  }
  token.conditions = token.conditions.filter((c) => !wanted.has(c.key));
  // Снятие эффекта-цели: если это была последняя цель каста — концентрация гаснет.
  for (const effect of removedEffects) {
    if (!effect.concentration || !effect.sourceId || !effect.sourceKey) continue;
    for (const changed of ctx.manager.pruneConcentration(room, effect.sourceId, effect.sourceKey)) {
      if (changed.token !== token) ctx.emitToken(room, 'token:update', changed.mapId, changed.token);
    }
  }
  ctx.emitToken(room, 'token:update', mapId, token);
  return removed.map((c) => c.name);
}

/** Снимает с токена все эффекты, наложенные зоной; true — что-то снято. */
export function removeZoneEffects(ctx: ConnCtx, room: Room, mapId: string, token: Token, zoneId: string): boolean {
  const ids = token.effects.filter((e) => e.zoneId === zoneId).map((e) => e.id);
  if (!ids.length) return false;
  for (const id of ids) ctx.manager.removeEffect(room, token, id);
  ctx.emitToken(room, 'token:update', mapId, token);
  return true;
}

/**
 * Досрочный обрыв эффектов по событию (Invisibility: бросок атаки/применение
 * заклинания носителем). `onlyIds` — снимок до события: эффекты, наложенные
 * самим событием, не трогаем. Возвращает id снятых эффектов.
 */
export function removeBrokenEffects(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  token: Token,
  event: 'attack' | 'spell' | 'damage',
  onlyIds?: Set<string>
): string[] {
  const broken = token.effects.filter(
    (e) => e.breakOn?.includes(event) && (!onlyIds || onlyIds.has(e.id))
  );
  if (!broken.length) return [];
  const anchors = new Set<string>();
  const removed: string[] = [];
  for (const effect of broken) {
    if (!ctx.manager.removeEffect(room, token, effect.id)) continue;
    removed.push(effect.id);
    if (effect.concentration && effect.sourceId && effect.sourceKey) {
      anchors.add(`${effect.sourceId}\n${effect.sourceKey}`);
    }
  }
  for (const anchor of anchors) {
    const [sourceId, sourceKey] = anchor.split('\n');
    if (!sourceId || !sourceKey) continue;
    for (const changed of ctx.manager.pruneConcentration(room, sourceId, sourceKey)) {
      if (changed.token !== token) ctx.emitToken(room, 'token:update', changed.mapId, changed.token);
    }
  }
  if (removed.length) ctx.emitToken(room, 'token:update', mapId, token);
  return removed;
}
