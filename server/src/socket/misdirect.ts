import { hasCondition, rollDice, type Token } from 'shared';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';
import { pushRollMessage } from './messages';

/**
 * Mirror Image: при попадании по носителю бросается кость за каждый оставшийся
 * образ; любой результат ≥ порога — удар принимает образ (он погибает), урона нет.
 * Ослеплённый атакующий образами не обманывается (blindsight/truesight не моделируются).
 */
export function misdirectCheck(
  ctx: ConnCtx,
  room: Room,
  mapId: string,
  target: Token,
  attacker: Token | null | undefined
): boolean {
  const effect = target.effects.find((e) => e.misdirect && (e.misdirect.charges ?? 0) > 0);
  const misdirect = effect?.misdirect;
  if (!effect || !misdirect) return false;
  if (attacker && hasCondition(attacker.conditions, 'blinded')) return false;

  const roll = rollDice(`${misdirect.charges}${misdirect.die}`);
  const success = roll.dice.some((die) => die.values.some((v) => v >= misdirect.threshold));
  pushRollMessage(ctx, room, {
    author: attacker?.name ?? 'Система',
    roll,
    kind: 'check',
    params: { subject: `Зеркальные образы · ${target.name}` },
  });
  if (!success) return false;

  const left = misdirect.charges - 1;
  if (left <= 0) ctx.manager.removeEffect(room, target, effect.id);
  else effect.misdirect = { ...misdirect, charges: left };
  ctx.emitToken(room, 'token:update', mapId, target);
  ctx.systemMessage(
    room,
    left > 0
      ? { code: 'misdirect.hitLeft', params: { name: target.name, left } }
      : { code: 'misdirect.hit', params: { name: target.name } }
  );
  return true;
}
