import { randomUUID } from 'node:crypto';
import { rollLabelText, type ChatMessage } from 'shared';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';

/**
 * Тик состояний активного бойца: повторные спасброски и истечение длительности.
 * Вызывается в начале/конце его хода.
 */
export function tickActiveConditions(ctx: ConnCtx, room: Room, mapId: string, phase: 'start' | 'end') {
  const combat = ctx.manager.combatOf(room, mapId);
  const entry = combat?.active && combat.currentIndex >= 0 ? combat.entries[combat.currentIndex] : undefined;
  if (!entry?.tokenId) return;
  const token = ctx.manager.findToken(room, mapId, entry.tokenId);
  if (!token) return;

  const result = ctx.manager.tickConditions(room, token, phase);
  for (const save of result.saves) {
    const params = {
      subject: `${save.name} · ${token.name}`,
      saveOutcome: (save.success ? 'success' : 'fail') as 'success' | 'fail',
    };
    const message: ChatMessage = {
      id: randomUUID(),
      kind: 'roll',
      author: 'Система',
      roll: save.roll,
      label: ctx.cleanLabel(rollLabelText('save', params)),
      rollKind: 'save',
      labelParams: params,
      ts: Date.now(),
    };
    ctx.manager.addMessage(room, message);
    ctx.broadcastAll('chat:message', message);
  }
  for (const name of result.removed) {
    ctx.systemMessage(room, `${token.name}: состояние «${name}» окончено`);
  }
  if (result.changed) ctx.emitToken(room, 'token:update', mapId, token);
}
