import { triggerOn, type Token } from 'shared';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';
import { pushSaveMessage } from './messages';

/**
 * Sanctuary: атакующий защищённую цель проходит спас Мдр (СЛ каста) или теряет
 * атаку/заклинание. Возвращает true — атака/каст блокированы.
 */
export function sanctuaryBlocks(
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
