import { rollDice, type Token } from 'shared';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';
import { applyDamage, singleDamageType } from './damage';
import { pushSaveMessage } from './messages';
import { removeConcSummonsOf, summonSourceIds } from './summons';
import { endShapesOf } from './forms';
import { removeZonesOfSource } from './zones';

/**
 * Триггеры эффектов в начале хода носителя (Heroism: врем. HP; смайты: повторный урон).
 * Вызывается до `tickEffects('start')`: урон ложится, затем идёт спасбросок untilSave.
 */
export function tickEffectTriggers(ctx: ConnCtx, room: Room, mapId: string, token: Token) {
  for (const effect of [...token.effects]) {
    const trigger = effect.triggers?.startOfTurn;
    if (!trigger) continue;
    if (trigger.tempHp && trigger.tempHp > 0) {
      ctx.manager.grantTempHp(room, token, trigger.tempHp);
      const cid = ctx.manager.controllerOfToken(room, token);
      if (cid) ctx.emitResources(room, cid);
      ctx.emitToken(room, 'token:update', mapId, token);
    }
    const damage = trigger.damage;
    if (!damage?.dice) continue;
    const roll = rollDice(damage.dice);
    if (roll.total <= 0) continue;
    const damageType = singleDamageType(damage.types);
    applyDamage(ctx, {
      target: token,
      mapId,
      amount: roll.total,
      damageType,
      roll,
      author: effect.name,
      kind: 'damage',
      params: { subject: `${effect.name} · ${token.name}`, damageType },
    });
  }
}

/**
 * Повторные спасброски эффектов «от урона» (Hideous Laughter): успех снимает
 * эффект вместе с состояниями; преимущество — флаг эффекта (XPHB).
 */
export function rollDamageSavesOnDamage(ctx: ConnCtx, room: Room, mapId: string, token: Token) {
  const pending = token.effects.filter((e) => e.saveOnDamage && e.duration.type === 'untilSave');
  for (const effect of pending) {
    const duration = effect.duration;
    if (duration.type !== 'untilSave') continue;
    const { roll, success } = ctx.manager.rollSave(room, token, duration.ability, duration.dc, {
      advantage: effect.saveOnDamage?.advantage,
    });
    pushSaveMessage(ctx, room, { subject: `${effect.name} · ${token.name}`, roll, success });
    if (success) {
      ctx.manager.removeEffect(room, token, effect.id);
      ctx.emitToken(room, 'token:update', mapId, token);
    }
  }
}

/**
 * Проверка концентрации при получении урона (СЛ 10 или половина урона).
 * Провал — эффекты концентрации снимаются, в чат уходит бросок и системка.
 */
export function rollConcentrationOnDamage(ctx: ConnCtx, room: Room, token: Token, damage: number) {
  if (!Number.isFinite(damage) || damage <= 0) return;
  const result = ctx.manager.concentrationCheck(room, token, damage);
  if (!result) return;
  pushSaveMessage(ctx, room, { subject: `Концентрация: ${result.names.join(', ')}`, roll: result.roll, success: result.success });
  if (!result.success) {
    for (const changed of result.changed) ctx.emitToken(room, 'token:update', changed.mapId, changed.token);
    removeZonesOfSource(ctx, room, token.id, { onlyConcentration: true });
    removeConcSummonsOf(ctx, room, summonSourceIds(room, token));
    endShapesOf(ctx, room, summonSourceIds(room, token));
    ctx.systemMessage(room, {
      code: 'concentration.broken',
      params: { name: token.name, effects: result.names.join(', ') },
    });
  }
}
