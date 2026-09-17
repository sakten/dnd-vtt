import {
  abilityMod,
  autoFailSave,
  concentrationDc,
  concentratingEffects,
  conditionName,
  effectDefenses,
  exhaustionRollPenalty,
  modifiedValue,
  rollDice,
  saveRollParts,
  sheetProficiencyBonus,
  statNumber,
  withAdvantage,
  withRollParts,
  type AbilityKey,
  type ConditionKey,
  type DamageDefense,
  type DiceRollResult,
  type EffectInstance,
  type RollParts,
  type Token,
} from 'shared';
import type { Room } from '../roomTypes';
import { actorStats } from './actor';
import { abilitiesForToken, turnStateFor } from './combat';
import { controllerIdOfToken } from './helpers';

/** Зависимости домена эффектов: сохранение и зеркалирование HP персонажа в токены. */
export interface EffectsDeps {
  saveSoon(room: Room): void;
  characterTokens(room: Room, playerId: string): { mapId: string; token: Token }[];
}

/** Защиты токена: у персонажа — из листа, у монстра — из токена, плюс эффекты. */
export function damageDefensesForToken(room: Room, token: Token): DamageDefense[] {
  const base = actorStats(room, token).damageDefenses;
  const extra = effectDefenses(token.effects);
  return extra.length ? [...base, ...extra] : base;
}

/** Бонус спасброска токена: мод. характеристики (+профишенси у персонажа). */
export function saveBonusForToken(room: Room, token: Token, ability: AbilityKey): number {
  const controllerId = controllerIdOfToken(room, token);
  const sheet = controllerId ? room.sheets[controllerId] : undefined;
  if (sheet) {
    const mod = abilityMod(sheet.abilities[ability] ?? 10);
    return sheet.saves[ability] ? mod + sheetProficiencyBonus(sheet) : mod;
  }
  const sb = token.statblock;
  const explicit = sb?.saves?.[ability];
  if (typeof explicit === 'number') return explicit;
  return abilityMod(sb?.abilities?.[ability] ?? 10);
}

/** Слагаемые/кости/режим спасброска токена: базовый бонус, эффекты, истощение. */
export function savePartsForToken(room: Room, token: Token, ability: AbilityKey): RollParts {
  const parts = saveRollParts(token.effects, ability, abilitiesForToken(room, token));
  parts.flat += saveBonusForToken(room, token, ability) + exhaustionRollPenalty(token.conditions);
  return parts;
}

/**
 * Бросок спасброска токена против СЛ. `conditionsAutoFail` — учитывать
 * авто-провал от состояний (парализован и т.п. для Силы/Ловкости).
 */
export function rollSave(
  room: Room,
  token: Token,
  ability: AbilityKey,
  dc: number,
  opts: { conditionsAutoFail?: boolean } = {}
): { roll: DiceRollResult; success: boolean } {
  const parts = savePartsForToken(room, token, ability);
  const roll = rollDice(withAdvantage(withRollParts('d20', parts), parts.mode));
  const autoFail = opts.conditionsAutoFail === true && autoFailSave(token.conditions, ability);
  return { roll, success: !autoFail && roll.total >= dc };
}

/**
 * Тик состояний в начале/конце хода носителя: повторный спасбросок (start/end)
 * и уменьшение длительности (раунды). Возвращает события для рассылки.
 */
export function tickConditions(
  m: EffectsDeps,
  room: Room,
  token: Token,
  phase: 'start' | 'end'
): { changed: boolean; saves: { name: string; roll: DiceRollResult; success: boolean }[]; removed: string[] } {
  const saves: { name: string; roll: DiceRollResult; success: boolean }[] = [];
  const removed: string[] = [];
  let changed = false;
  const kept = token.conditions.filter((cond) => {
    let remove = false;
    if (cond.save && cond.save.timing === phase) {
      const { roll, success } = rollSave(room, token, cond.save.ability, cond.save.dc);
      saves.push({ name: cond.name, roll, success });
      if (success) remove = true;
    }
    if (!remove && phase === 'start' && cond.rounds != null) {
      cond.rounds -= 1;
      if (cond.rounds <= 0) {
        remove = true;
        removed.push(cond.name);
      }
    }
    if (remove) changed = true;
    return !remove;
  });
  token.conditions = kept;
  if (changed) m.saveSoon(room);
  return { changed, saves, removed };
}

/** Накладывает эффект на токен и связанные с ним состояния. */
export function applyEffect(m: EffectsDeps, room: Room, token: Token, effect: EffectInstance) {
  token.effects = [...token.effects.filter((e) => e.id !== effect.id), effect];
  changeMaxHp(m, room, token, effect, 1);
  if (effect.conditions?.length) {
    for (const key of effect.conditions) {
      if (token.conditions.some((c) => c.effectId === effect.id && c.key === key)) continue;
      token.conditions.push({
        key,
        name: conditionName(key),
        rounds: null,
        sourceId: effect.sourceId,
        sourceKey: effect.sourceKey,
        effectId: effect.id,
      });
    }
  }
  m.saveSoon(room);
}

/** Снимает эффект и его состояния с токена; false — эффекта не было. */
export function removeEffect(m: EffectsDeps, room: Room, token: Token, effectId: string): boolean {
  const effect = token.effects.find((e) => e.id === effectId);
  if (!effect) return false;
  changeMaxHp(m, room, token, effect, -1);
  token.effects = token.effects.filter((e) => e.id !== effectId);
  token.conditions = token.conditions.filter((c) => c.effectId !== effectId);
  m.saveSoon(room);
  return true;
}

/**
 * Применяет/откатывает бонус к максимуму HP от эффекта (Aid и подобные):
 * у персонажа — в ресурсах (с зеркалом в токены), у монстра — в токене.
 */
export function changeMaxHp(m: EffectsDeps, room: Room, token: Token, effect: EffectInstance, sign: 1 | -1) {
  const bonus = modifiedValue(0, [effect], 'maxHp', {}, abilitiesForToken(room, token));
  if (!bonus) return;
  const controllerId = controllerIdOfToken(room, token);
  const res = controllerId ? room.resources[controllerId] : undefined;
  if (controllerId && res && res.hp.max > 0) {
    res.hp.max = Math.max(1, res.hp.max + sign * bonus);
    if (sign > 0) res.hp.current += bonus;
    else res.hp.current = Math.min(res.hp.current, res.hp.max);
    m.characterTokens(room, controllerId);
  } else {
    const base = statNumber(token.hpMax);
    if (base > 0) token.hpMax = String(Math.max(1, base + sign * bonus));
    if (sign > 0) token.hpCurrent += bonus;
    else token.hpCurrent = Math.min(token.hpCurrent, statNumber(token.hpMax));
  }
}

/**
 * Выдаёт временные HP (не складываются: сохраняется большее значение).
 * Персонажу — в ресурсы с зеркалом в токены, монстру — в токен.
 */
export function grantTempHp(m: EffectsDeps, room: Room, token: Token, amount: number): void {
  const value = Math.max(0, Math.round(amount));
  if (!value) return;
  const controllerId = controllerIdOfToken(room, token);
  const res = controllerId ? room.resources[controllerId] : undefined;
  if (controllerId && res) {
    res.hp.temp = Math.max(res.hp.temp, value);
    m.saveSoon(room);
    m.characterTokens(room, controllerId);
    return;
  }
  token.hpTemp = Math.max(token.hpTemp, value);
  m.saveSoon(room);
}

/**
 * Тик эффектов в начале/конце хода носителя: повторные спасброски, раунды,
 * эскалация состояний (Sleep). `endOfTurn` снимаются в начале хода владельца
 * (`of: 'target'`) или источника (`of: 'source'`, в т.ч. с чужих токенов) —
 * это же трактуется как «до начала следующего хода».
 */
export function tickEffects(
  m: EffectsDeps,
  room: Room,
  token: Token,
  phase: 'start' | 'end'
): {
  changed: boolean;
  saves: { name: string; roll: DiceRollResult; success: boolean }[];
  removed: string[];
  escalated: { name: string; condition: ConditionKey }[];
} {
  const saves: { name: string; roll: DiceRollResult; success: boolean }[] = [];
  const removed: string[] = [];
  const escalated: { name: string; condition: ConditionKey }[] = [];
  let changed = false;

  const kept = token.effects.filter((effect) => {
    let remove = false;
    const d = effect.duration;
    if (d.type === 'untilSave' && d.timing === phase) {
      const { roll, success } = rollSave(room, token, d.ability, d.dc);
      saves.push({ name: effect.name, roll, success });
      if (success) remove = true;
      else if (effect.escalate) {
        // Провал повторного спасброска: состояние меняется (Sleep → без сознания).
        const next = effect.escalate;
        effect.duration = next.duration ?? effect.duration;
        effect.conditions = [next.condition];
        effect.escalate = undefined;
        for (const cond of token.conditions) {
          if (cond.effectId !== effect.id) continue;
          cond.key = next.condition;
          cond.name = conditionName(next.condition);
        }
        escalated.push({ name: effect.name, condition: next.condition });
        changed = true;
      }
    }
    if (!remove && d.type === 'rounds' && phase === 'start') {
      d.rounds -= 1;
      changed = true;
      if (d.rounds <= 0) {
        remove = true;
        removed.push(effect.name);
      }
    }
    if (!remove && d.type === 'endOfTurn' && phase === 'start') {
      if (d.of === 'target' || effect.sourceId === token.id) {
        remove = true;
        removed.push(effect.name);
      }
    }
    if (remove) {
      changeMaxHp(m, room, token, effect, -1);
      token.conditions = token.conditions.filter((c) => c.effectId !== effect.id);
      changed = true;
    }
    return !remove;
  });
  token.effects = kept;

  for (const map of room.scene.maps) {
    for (const other of map.tokens) {
      if (other === token) continue;
      const keptOther = other.effects.filter((effect) => {
        if (
          phase === 'start' &&
          effect.duration.type === 'endOfTurn' &&
          effect.duration.of === 'source' &&
          effect.sourceId === token.id
        ) {
          changeMaxHp(m, room, other, effect, -1);
          other.conditions = other.conditions.filter((c) => c.effectId !== effect.id);
          removed.push(effect.name);
          changed = true;
          return false;
        }
        return true;
      });
      other.effects = keptOther;
    }
  }

  if (changed) m.saveSoon(room);
  return { changed, saves, removed, escalated };
}

/** Эффекты концентрации существа-источника на всех картах. */
export function concentratingEffectsOf(room: Room, token: Token): EffectInstance[] {
  const out: EffectInstance[] = [];
  for (const map of room.scene.maps) {
    for (const target of map.tokens) {
      out.push(...concentratingEffects(target.effects, token.id));
    }
  }
  return out;
}

/** Снимает все эффекты концентрации заклинателя; возвращает изменённые токены. */
export function clearConcentration(m: EffectsDeps, room: Room, sourceId: string): { mapId: string; token: Token }[] {
  const changed: { mapId: string; token: Token }[] = [];
  for (const map of room.scene.maps) {
    for (const token of map.tokens) {
      const removedIds = new Set(
        token.effects.filter((e) => e.concentration && e.sourceId === sourceId).map((e) => e.id)
      );
      if (!removedIds.size) continue;
      for (const effect of token.effects) {
        if (removedIds.has(effect.id)) changeMaxHp(m, room, token, effect, -1);
      }
      token.effects = token.effects.filter((e) => !removedIds.has(e.id));
      token.conditions = token.conditions.filter((c) => !(c.effectId && removedIds.has(c.effectId)));
      changed.push({ mapId: map.id, token });
    }
    for (const entry of map.combat.entries) {
      const turn = map.combat.turns[entry.id];
      if (turn?.concentrationId && entry.tokenId === sourceId) turn.concentrationId = null;
    }
  }
  if (changed.length) m.saveSoon(room);
  return changed;
}

/** Запоминает эффект концентрации в состоянии хода заклинателя. */
export function setConcentration(m: EffectsDeps, room: Room, mapId: string, token: Token, effectId: string) {
  const turn = turnStateFor(room, mapId, token);
  if (!turn) return;
  turn.concentrationId = effectId;
  m.saveSoon(room);
}

/**
 * Долгий отдых: снимает с токенов персонажа все эффекты (с откатом maxHp),
 * их состояния и концентрацию (в т.ч. на других токенах). Возвращает изменения.
 */
export function clearEffectsForPlayer(m: EffectsDeps, room: Room, playerId: string): { mapId: string; token: Token }[] {
  const libId = room.controllers[playerId];
  if (!libId) return [];
  const changed = new Map<string, { mapId: string; token: Token }>();
  for (const map of room.scene.maps) {
    for (const token of map.tokens) {
      if (token.libraryItemId !== libId) continue;
      for (const c of clearConcentration(m, room, token.id)) changed.set(c.token.id, c);
      if (!token.effects.length) continue;
      const removedIds = new Set(token.effects.map((e) => e.id));
      for (const effect of token.effects) changeMaxHp(m, room, token, effect, -1);
      token.effects = [];
      token.conditions = token.conditions.filter((c) => !(c.effectId && removedIds.has(c.effectId)));
      changed.set(token.id, { mapId: map.id, token });
    }
  }
  if (changed.size) m.saveSoon(room);
  return [...changed.values()];
}

/**
 * Проверка концентрации при получении урона: СЛ 10 или половина урона.
 * При провале эффекты концентрации снимаются. null — концентрации нет.
 */
export function concentrationCheck(
  m: EffectsDeps,
  room: Room,
  token: Token,
  damage: number
):
  | {
      dc: number;
      roll: DiceRollResult;
      success: boolean;
      names: string[];
      changed: { mapId: string; token: Token }[];
    }
  | null {
  const active = concentratingEffectsOf(room, token);
  if (!active.length) return null;
  const dc = concentrationDc(damage);
  const { roll, success } = rollSave(room, token, 'con', dc);
  const names = [...new Set(active.map((e) => e.name))];
  const changed = success ? [] : clearConcentration(m, room, token.id);
  return { dc, roll, success, names, changed };
}

/** Навешивает «Без сознания»/«Мёртв»/ничего по состоянию HP (прочие состояния сохраняются). */
function applyDownState(token: Token, downed: boolean, dead: boolean) {
  const rest = token.conditions.filter((c) => c.key !== 'unconscious' && c.key !== 'dead');
  if (dead) rest.push({ key: 'dead', name: conditionName('dead'), rounds: null });
  else if (downed) rest.push({ key: 'unconscious', name: conditionName('unconscious'), rounds: null });
  token.conditions = rest;
}

/** Помечает все токены персонажа мёртвыми/живыми (по итогу death-сейвов). */
export function markControlledTokensDead(
  m: EffectsDeps,
  room: Room,
  playerId: string,
  dead: boolean
): { mapId: string; token: Token }[] {
  const libId = room.controllers[playerId];
  if (!libId) return [];
  const changed: { mapId: string; token: Token }[] = [];
  for (const map of room.scene.maps) {
    for (const token of map.tokens) {
      if (token.libraryItemId !== libId) continue;
      applyDownState(token, !dead, dead);
      changed.push({ mapId: map.id, token });
    }
  }
  if (changed.length) m.saveSoon(room);
  return changed;
}

/**
 * Изменяет HP токена с учётом канона: у персонажа HP живёт в PlayerResources
 * и зеркалится в токены, у монстров — прямо в токене. HP может уходить в минус.
 * Лечение сбрасывает death-сейвы; урон лежачему добавляет провал (крит — 2);
 * HP ≤ 0 → «Без сознания»/«Мёртв». Возвращает изменившиеся токены для рассылки.
 */
/** Урон снимает эффекты с `wakeOnDamage` (Sleep, Hypnotic Pattern) вместе с их состояниями. */
function wakeOnDamage(m: EffectsDeps, room: Room, token: Token) {
  const waking = token.effects.filter((e) => e.wakeOnDamage);
  if (!waking.length) return;
  const ids = new Set(waking.map((e) => e.id));
  for (const effect of waking) changeMaxHp(m, room, token, effect, -1);
  token.effects = token.effects.filter((e) => !ids.has(e.id));
  token.conditions = token.conditions.filter((c) => !(c.effectId && ids.has(c.effectId)));
}

export function adjustTokenHp(
  m: EffectsDeps,
  room: Room,
  mapId: string,
  token: Token,
  delta: number,
  opts: { crit?: boolean } = {}
): { mapId: string; token: Token }[] {
  if (delta < 0) wakeOnDamage(m, room, token);
  const controllerId = controllerIdOfToken(room, token);
  const res = controllerId ? room.resources[controllerId] : undefined;
  if (controllerId && res && res.hp.max > 0) {
    if (delta < 0 && res.hp.temp > 0) {
      const absorbed = Math.min(res.hp.temp, -delta);
      res.hp.temp -= absorbed;
      delta += absorbed;
    }
    const before = res.hp.current;
    let next = before + delta;
    next = Math.min(res.hp.max, next);
    res.hp.current = next;
    if (delta > 0) {
      res.hp.deathSuccesses = 0;
      res.hp.deathFailures = 0;
    } else if (delta < 0 && before <= 0) {
      res.hp.deathFailures = Math.min(3, res.hp.deathFailures + (opts.crit ? 2 : 1));
    }
    m.saveSoon(room);
    const changed = m.characterTokens(room, controllerId);
    for (const c of changed) {
      applyDownState(c.token, res.hp.current <= 0 && res.hp.deathFailures < 3, res.hp.deathFailures >= 3);
    }
    return changed;
  }
  const max = statNumber(token.hpMax);
  if (delta < 0 && token.hpTemp > 0) {
    const absorbed = Math.min(token.hpTemp, -delta);
    token.hpTemp -= absorbed;
    delta += absorbed;
  }
  let next = token.hpCurrent + delta;
  if (max > 0) next = Math.min(max, next);
  token.hpCurrent = next;
  applyDownState(token, next <= 0, next <= 0);
  m.saveSoon(room);
  return [{ mapId, token }];
}
