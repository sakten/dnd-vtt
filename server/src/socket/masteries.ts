import { randomUUID } from 'node:crypto';
import {
  characterLevel,
  proficiencyBonus,
  weaponAbilityMod,
  weaponByKey,
  weaponMastery,
  type AbilityKey,
  type AttackEntry,
  type ClassLevel,
  type EffectInstance,
  type Token,
} from 'shared';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';
import { controllerIdOfToken } from '../rooms';
import { applyForcedMovement } from './force';
import { pushSaveMessage } from './messages';

/** Русские имена мастерств для эффектов и чата (совпадают с i18n-лейблами). */
export const MASTERY_RU: Record<string, string> = {
  Cleave: 'Прорубающее',
  Graze: 'Секущее',
  Nick: 'Быстрое',
  Push: 'Отталкивающее',
  Sap: 'Ослабляющее',
  Slow: 'Замедляющее',
  Topple: 'Опрокидывающее',
  Vex: 'Отвлекающее',
};

/** Классы и характеристики атакующего для расчёта мастерств. */
function attackerContext(
  ctx: ConnCtx,
  room: Room,
  attacker: Token
): { classes: ClassLevel[] | undefined; abilities: Partial<Record<AbilityKey, number>> } {
  const cid = controllerIdOfToken(room, attacker);
  const sheet = cid ? room.sheets[cid] : undefined;
  return {
    classes: sheet?.classes,
    abilities: (ctx.manager.abilitiesForToken(room, attacker) ?? {}) as Partial<Record<AbilityKey, number>>,
  };
}

/** Активное мастерство атаки с учётом класса владельца токена (нет доступа — undefined). */
export function masteryFor(ctx: ConnCtx, room: Room, attacker: Token, attack: AttackEntry): string | undefined {
  const { classes } = attackerContext(ctx, room, attacker);
  return weaponMastery(attack, classes);
}

/** Урон Graze при промахе: модификатор использованной характеристики, но не меньше нуля. */
export function grazeDamage(ctx: ConnCtx, room: Room, attacker: Token, attack: AttackEntry): number {
  const weapon = attack.weaponKey ? weaponByKey(attack.weaponKey) : undefined;
  if (!weapon) return 0;
  const { classes, abilities } = attackerContext(ctx, room, attacker);
  if (weaponMastery(attack, classes) !== 'Graze') return 0;
  return Math.max(0, weaponAbilityMod(weapon, { abilities, classes: classes ?? [] }));
}

function masteryEffect(
  mastery: string,
  attacker: Token,
  duration: EffectInstance['duration'],
  modifiers: EffectInstance['modifiers'],
  extra: Partial<EffectInstance> = {}
): EffectInstance {
  const id = randomUUID();
  return {
    id,
    name: MASTERY_RU[mastery] ?? mastery,
    sourceKey: `mastery:${mastery}`,
    sourceId: attacker.id,
    duration,
    modifiers: modifiers.map((m, i) => ({ ...m, id: m.id || `${id}:m${i}` })),
    ...extra,
  };
}

/**
 * Мастерства на попадании (без требования урона): Sap — помеха на следующий бросок атаки цели.
 * Вызывается после подтверждения попадания (в т.ч. с учётом реакций на AC).
 */
export function applyHitMastery(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  attacker: Token,
  target: Token,
  attack: AttackEntry
): void {
  const mastery = masteryFor(ctx, room, attacker, attack);
  if (mastery === 'Cleave' && attack.weaponKey) {
    // Помечаем вторую цель для «Прорубить»: кнопка появится в панели свободных действий.
    const turn = ctx.manager.turnStateFor(room, mapId, attacker);
    if (turn && !turn.cleaveUsed) {
      turn.cleaveFrom = target.id;
      turn.cleaveWeapon = attack.weaponKey;
      ctx.syncCombat(room, mapId);
    }
    return;
  }
  if (mastery !== 'Sap') return;
  const effect = masteryEffect(
    'Sap',
    attacker,
    { type: 'endOfTurn', of: 'source' },
    [{ id: '', target: 'attack', mode: 'disadvantage', filter: { direction: 'self' } }],
    { consumeOnAttackRoll: true }
  );
  ctx.manager.applyEffect(room, target, effect);
  ctx.emitToken(room, 'token:update', mapId, target);
}

/**
 * Мастерства, срабатывающие при нанесённом уроне: Vex — преимущество на следующую
 * атаку по цели; Slow — скорость −10 футов до начала следующего хода атакующего.
 */
export function applyDamageMastery(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  attacker: Token,
  target: Token,
  attack: AttackEntry
): void {
  const mastery = masteryFor(ctx, room, attacker, attack);
  if (mastery === 'Vex') {
    const effect = masteryEffect(
      'Vex',
      attacker,
      { type: 'endOfTurn', of: 'target' },
      [{ id: '', target: 'attack', mode: 'advantage', filter: { targetId: target.id, direction: 'self', weapon: true } }],
      { consumeOnAttackRoll: true }
    );
    ctx.manager.applyEffect(room, attacker, effect);
    ctx.emitToken(room, 'token:update', mapId, attacker);
    return;
  }
  if (mastery === 'Slow') {
    const effect = masteryEffect('Slow', attacker, { type: 'endOfTurn', of: 'source' }, [
      { id: '', target: 'speed', mode: 'add', value: -10 },
    ]);
    ctx.manager.applyEffect(room, target, effect);
    ctx.emitToken(room, 'token:update', mapId, target);
  }
}

/**
 * Мастерства по выбору (Push/Topple): применяются из окна выбора наездников при попадании.
 * Push — толчок на 10 футов (Large и меньше), Topple — спасбросок Тел. против СЛ 8+владение+мод.
 */
export function applyMasteryChoice(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  attacker: Token,
  target: Token,
  attack: AttackEntry,
  mastery: string
): void {
  const weapon = attack.weaponKey ? weaponByKey(attack.weaponKey) : undefined;
  if (!weapon) return;
  const { classes, abilities } = attackerContext(ctx, room, attacker);
  if (weaponMastery(attack, classes) !== mastery) return;
  if (mastery === 'Push') {
    applyForcedMovement(ctx, room, mapId, attacker, target, { kind: 'push', feet: 10, maxSize: 'large' });
    return;
  }
  if (mastery === 'Topple') {
    const pb = proficiencyBonus(characterLevel(classes ?? []) || 1);
    const dc = 8 + pb + weaponAbilityMod(weapon, { abilities, classes: classes ?? [] });
    const { roll, success } = ctx.manager.rollSave(room, target, 'con', dc, {
      conditionsAutoFail: true,
      condition: 'prone',
    });
    pushSaveMessage(ctx, room, {
      author: attacker.name,
      subject: `${MASTERY_RU.Topple ?? 'Topple'} · ${target.name}`,
      roll,
      success,
    });
    if (success) return;
    const effect = masteryEffect('Topple', attacker, { type: 'permanent' }, [], { conditions: ['prone'] });
    ctx.manager.applyEffect(room, target, effect);
    ctx.emitToken(room, 'token:update', mapId, target);
  }
}

/**
 * Одноразовые эффекты (Sap/Vex, Zephyr Strike) сгорают после ближайшего броска атаки
 * носителя; Vex — только когда атака идёт по помеченной цели. Zephyr дополнительно
 * возвращает райдер урона и выдаёт скорость +30 до конца хода (даже при промахе).
 */
export function consumeAttackRollEffects(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  attacker: Token,
  target: Token | null
): { rider?: { dice: string; damageType: string } } {
  const oneShot = attacker.effects.filter((effect) => effect.consumeOnAttackRoll);
  if (!oneShot.length) return {};
  let changed = false;
  let rider: { dice: string; damageType: string } | undefined;
  for (const effect of oneShot) {
    const marked = effect.modifiers.find((m) => m.filter?.targetId)?.filter?.targetId;
    if (marked && marked !== target?.id) continue;
    if (effect.zephyrStrike) {
      rider = { dice: effect.zephyrStrike.dice, damageType: effect.zephyrStrike.damageType };
      const speedId = randomUUID();
      ctx.manager.applyEffect(room, attacker, {
        id: speedId,
        name: effect.name,
        sourceKey: effect.sourceKey,
        sourceId: effect.sourceId,
        duration: { type: 'endOfTurn', of: 'target' },
        modifiers: [{ id: `${speedId}:m0`, target: 'speed', mode: 'add', value: effect.zephyrStrike.speedFeet }],
      });
    }
    if (ctx.manager.removeEffect(room, attacker, effect.id)) changed = true;
  }
  if (changed) ctx.emitToken(room, 'token:update', mapId, attacker);
  return rider ? { rider } : {};
}

/**
 * Расходует заряды эффектов на броске атаки (Flame Arrows: 1 боеприпас за
 * дальнобойную оружейную атаку). На нуле эффект гаснет с системкой в чат.
 */
export function spendAttackCharges(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  attacker: Token,
  attack: AttackEntry
): void {
  if (attack.rangeType !== 'ranged') return;
  let changed = false;
  for (const effect of [...attacker.effects]) {
    const charges = effect.charges;
    if (!charges || charges.on !== 'rangedWeaponAttack') continue;
    charges.remaining -= 1;
    changed = true;
    if (charges.remaining <= 0) {
      ctx.manager.removeEffect(room, attacker, effect.id);
      ctx.systemMessage(room, { code: 'automation.chargesSpent', params: { name: effect.name } });
    }
  }
  if (changed) ctx.emitToken(room, 'token:update', mapId, attacker);
}
