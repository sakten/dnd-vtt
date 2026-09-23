import {
  abilityMod,
  autoFailSave,
  concentrationDc,
  concentratingEffects,
  conditionName,
  effectDefenses,
  exhaustionRollPenalty,
  hasConcentrationAdvantage,
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
import { revertShape, shapeGrid } from './shape';

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
  // В форме спасброски — сводные (владения свои, явные бонусы зверя выше своих).
  if (token.shape) {
    const stats = actorStats(room, token);
    const explicit = stats.saves?.[ability];
    if (typeof explicit === 'number') return explicit;
    return abilityMod(stats.abilities?.[ability] ?? 10);
  }
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
  opts: { conditionsAutoFail?: boolean; advantage?: boolean } = {}
): { roll: DiceRollResult; success: boolean } {
  const parts = savePartsForToken(room, token, ability);
  const mode = opts.advantage ? (parts.mode === 'd' ? undefined : 'a') : parts.mode;
  const roll = rollDice(withAdvantage(withRollParts('d20', parts), mode));
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
): {
  changed: boolean;
  saves: { name: string; roll: DiceRollResult; success: boolean }[];
  removed: { key: ConditionKey; name: string }[];
} {
  const saves: { name: string; roll: DiceRollResult; success: boolean }[] = [];
  const removed: { key: ConditionKey; name: string }[] = [];
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
        removed.push({ key: cond.key, name: cond.name });
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
  /** Токены с снятой концентрацией (последняя цель каста ушла). */
  pruned: { mapId: string; token: Token }[];
} {
  const saves: { name: string; roll: DiceRollResult; success: boolean }[] = [];
  const removed: string[] = [];
  const escalated: { name: string; condition: ConditionKey }[] = [];
  const removedConcentration: { sourceId: string; sourceKey: string }[] = [];
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
      if (effect.concentration && effect.sourceId && effect.sourceKey) {
        removedConcentration.push({ sourceId: effect.sourceId, sourceKey: effect.sourceKey });
      }
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
          if (effect.concentration && effect.sourceId && effect.sourceKey) {
            removedConcentration.push({ sourceId: effect.sourceId, sourceKey: effect.sourceKey });
          }
          changed = true;
          return false;
        }
        return true;
      });
      other.effects = keptOther;
    }
  }

  const pruned = new Map<string, { mapId: string; token: Token }>();
  const seen = new Set<string>();
  for (const { sourceId, sourceKey } of removedConcentration) {
    const key = `${sourceId}\u0000${sourceKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    for (const c of pruneConcentration(m, room, sourceId, sourceKey)) pruned.set(c.token.id, c);
  }

  if (changed) m.saveSoon(room);
  return { changed, saves, removed, escalated, pruned: [...pruned.values()] };
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

/** Служебный якорь концентрации: пустая запись на кастере (без цели, состояний и модификаторов). */
function isConcentrationAnchor(effect: EffectInstance): boolean {
  return (
    effect.duration.type === 'concentration' &&
    !effect.conditions?.length &&
    !effect.modifiers.length &&
    !effect.mark &&
    !effect.bonusDie &&
    !effect.light &&
    !effect.restrictions &&
    !effect.wakeOnDamage
  );
}

/**
 * Концентрация без цели: после снятия эффекта, если у каста (`sourceId` + `sourceKey`)
 * не осталось эффектов-целей и нет зоны — снимает концентрацию с кастера.
 * Области не трогаем: их триггеры живут, пока зона на карте.
 */
export function pruneConcentration(
  m: EffectsDeps,
  room: Room,
  sourceId: string,
  sourceKey: string
): { mapId: string; token: Token }[] {
  if (room.scene.maps.some((map) => map.zones.some((z) => z.sourceId === sourceId && z.sourceKey === sourceKey))) {
    return [];
  }
  for (const map of room.scene.maps) {
    for (const token of map.tokens) {
      const remains = token.effects.some(
        (e) => e.concentration && e.sourceId === sourceId && e.sourceKey === sourceKey && !isConcentrationAnchor(e)
      );
      if (remains) return [];
    }
  }
  return clearConcentration(m, room, sourceId);
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
  // Eldritch Mind: преимущество на спасброски концентрации.
  const controllerId = controllerIdOfToken(room, token);
  const advantage = !!controllerId && hasConcentrationAdvantage(room.sheets[controllerId] ?? {});
  const { roll, success } = rollSave(room, token, 'con', dc, { advantage });
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
function wakeOnDamage(m: EffectsDeps, room: Room, token: Token): { mapId: string; token: Token }[] {
  const pruned = new Map<string, { mapId: string; token: Token }>();
  for (const effect of [...token.effects]) {
    if (!effect.wakeOnDamage) continue;
    if (!removeEffect(m, room, token, effect.id)) continue;
    if (!effect.concentration || !effect.sourceId || !effect.sourceKey) continue;
    for (const c of pruneConcentration(m, room, effect.sourceId, effect.sourceKey)) pruned.set(c.token.id, c);
  }
  return [...pruned.values()];
}

/** Снимает Death Ward при падении до 0 HP; true — защита сработала (HP вместо этого = 1). */
function consumeDeathWard(m: EffectsDeps, room: Room, token: Token): boolean {
  const ward = token.effects.find((e) => e.deathWard);
  if (!ward) return false;
  removeEffect(m, room, token, ward.id);
  return true;
}

/** Склеивает списки изменённых токенов без дублей (по id токена). */
function mergeChanges(
  base: { mapId: string; token: Token }[],
  extra: { mapId: string; token: Token }[]
): { mapId: string; token: Token }[] {
  const seen = new Set(base.map((c) => c.token.id));
  return [...base, ...extra.filter((c) => !seen.has(c.token.id))];
}

export function adjustTokenHp(
  m: EffectsDeps,
  room: Room,
  mapId: string,
  token: Token,
  delta: number,
  opts: { crit?: boolean } = {}
): { mapId: string; token: Token }[] {
  const woken = delta < 0 ? wakeOnDamage(m, room, token) : [];
  // Урон в форме: сначала отдельный пул формы; обнуление — возврат.
  if (delta < 0 && token.shape) {
    const shape = token.shape;
    const absorbed = Math.min(shape.hp, -delta);
    shape.hp -= absorbed;
    delta += absorbed;
    // Polymorph: temp HP зверя обнулились — заклинание оканчивается (XPHB), избыток идёт в свои HP.
    // Wild Shape: форма живёт дальше (XPHB) — урон сверх пула уходит в свои HP, форма не спадает.
    if (shape.hp <= 0 && shape.kind === 'polymorph') revertShape(token, shapeGrid(room, mapId));
  }
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
    if (delta < 0 && before > 0 && next <= 0 && consumeDeathWard(m, room, token)) next = 1;
    res.hp.current = next;
    if (delta > 0) {
      // Лечение не оживляет: у мёртвого счётчики и «Мёртв» не сбрасываются (оживляет Revivify/ДМ).
      if (res.hp.deathFailures < 3) {
        res.hp.deathSuccesses = 0;
        res.hp.deathFailures = 0;
        if (next > 0) delete res.hp.stable;
      }
    } else if (delta < 0 && before <= 0) {
      // Урон по лежачему снимает стабильность и начинает death-сейвы заново.
      delete res.hp.stable;
      res.hp.deathSuccesses = 0;
      res.hp.deathFailures = Math.min(3, res.hp.deathFailures + (opts.crit ? 2 : 1));
    }
    m.saveSoon(room);
    const changed = m.characterTokens(room, controllerId);
    for (const c of changed) {
      applyDownState(c.token, res.hp.current <= 0 && res.hp.deathFailures < 3, res.hp.deathFailures >= 3);
    }
    return mergeChanges(changed, woken);
  }
  const max = statNumber(token.hpMax);
  if (delta < 0 && token.hpTemp > 0) {
    const absorbed = Math.min(token.hpTemp, -delta);
    token.hpTemp -= absorbed;
    delta += absorbed;
  }
  let next = token.hpCurrent + delta;
  if (max > 0) next = Math.min(max, next);
  if (delta < 0 && token.hpCurrent > 0 && next <= 0 && consumeDeathWard(m, room, token)) next = 1;
  const wasDead = token.conditions.some((c) => c.key === 'dead');
  token.hpCurrent = next;
  // Монстр мёртв при HP ≤ 0; лечение не оживляет (оживляет Revivify или снятие «Мёртв» ДМом).
  applyDownState(token, !wasDead && next <= 0, wasDead || next <= 0);
  m.saveSoon(room);
  return mergeChanges([{ mapId, token }], woken);
}

/** Оживляет мёртвого (Revivify): HP = 1, death-сейвы и стабильность сброшены. */
export function reviveToken(
  m: EffectsDeps,
  room: Room,
  mapId: string,
  token: Token
): { mapId: string; token: Token }[] {
  const controllerId = controllerIdOfToken(room, token);
  const res = controllerId ? room.resources[controllerId] : undefined;
  if (controllerId && res && res.hp.max > 0) {
    res.hp.current = Math.min(res.hp.max, 1);
    res.hp.deathSuccesses = 0;
    res.hp.deathFailures = 0;
    delete res.hp.stable;
    m.saveSoon(room);
    const changed = m.characterTokens(room, controllerId);
    for (const c of changed) applyDownState(c.token, false, false);
    return changed;
  }
  const max = statNumber(token.hpMax);
  token.hpCurrent = max > 0 ? Math.min(max, 1) : 1;
  applyDownState(token, false, false);
  m.saveSoon(room);
  return [{ mapId, token }];
}

/** Стабилизирует существо на 0 HP (Spare the Dying): death-сейвы больше не бросаются. */
export function stabilizeToken(m: EffectsDeps, room: Room, token: Token): { mapId: string; token: Token }[] {
  const controllerId = controllerIdOfToken(room, token);
  const res = controllerId ? room.resources[controllerId] : undefined;
  if (!controllerId || !res || res.hp.max <= 0) return [];
  res.hp.stable = true;
  res.hp.deathFailures = 0;
  m.saveSoon(room);
  return m.characterTokens(room, controllerId);
}

/** Ручное снятие «Мёртв» (ДМ): сбрасывает death-сейвы и стабильность, лежачих — в «Без сознания». */
export function clearDeadState(m: EffectsDeps, room: Room, playerId: string): { mapId: string; token: Token }[] {
  const res = room.resources[playerId];
  if (!res) return [];
  res.hp.deathSuccesses = 0;
  res.hp.deathFailures = 0;
  delete res.hp.stable;
  m.saveSoon(room);
  const changed = m.characterTokens(room, playerId);
  for (const c of changed) applyDownState(c.token, res.hp.current <= 0, false);
  return changed;
}

