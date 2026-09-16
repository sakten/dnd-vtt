import { randomUUID } from 'node:crypto';
import { type ChatMessage, type DiceRollResult, type RollKind, type RollLabelParams } from 'shared';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';

export interface RollMessageInput {
  author: string;
  roll: DiceRollResult;
  /** Вид броска (структурная метка). Без него и без `label` карточка идёт без подписи. */
  kind?: RollKind;
  params?: RollLabelParams;
  /** Явная метка (повтор броска из чата). */
  label?: string;
  crit?: boolean;
}

/** Сообщение-бросок в чат: единая точка метки и рассылки для всех резолверов. */
export function pushRollMessage(ctx: ConnCtx, room: Room, input: RollMessageInput): ChatMessage {
  const message: ChatMessage = {
    id: randomUUID(),
    kind: 'roll',
    author: input.author,
    roll: input.roll,
    ts: Date.now(),
    ...(input.label !== undefined && { label: input.label }),
    ...(input.kind !== undefined && { rollKind: input.kind, labelParams: input.params }),
    ...(input.crit !== undefined && { crit: input.crit }),
  };
  ctx.manager.addMessage(room, message);
  ctx.broadcastAll('chat:message', message);
  return message;
}

/** Текстовое сообщение в чат (по умолчанию системное). */
export function pushTextMessage(ctx: ConnCtx, room: Room, text: string, author = 'Система'): ChatMessage {
  const message: ChatMessage = { id: randomUUID(), kind: 'text', author, text, ts: Date.now() };
  ctx.manager.addMessage(room, message);
  ctx.broadcastAll('chat:message', message);
  return message;
}

/** Сообщение спасброска: метка «<subject> · успех/провал». */
export function pushSaveMessage(
  ctx: ConnCtx,
  room: Room,
  input: { author: string; subject: string; roll: DiceRollResult; success: boolean }
): ChatMessage {
  return pushRollMessage(ctx, room, {
    author: input.author,
    roll: input.roll,
    kind: 'save',
    params: { subject: input.subject, saveOutcome: input.success ? 'success' : 'fail' },
  });
}
