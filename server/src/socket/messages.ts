import { randomUUID } from 'node:crypto';
import { rollLabelText, type ChatMessage, type DiceRollResult, type RollKind, type RollLabelParams } from 'shared';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';

export interface RollMessageInput {
  author: string;
  roll: DiceRollResult;
  /** Вид броска; без него метка берётся из `label` (legacy-сообщения, хит-дайс). */
  kind?: RollKind;
  params?: RollLabelParams;
  /** Готовая метка вместо сгенерированной из kind/params. */
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
  if (input.label === undefined && input.kind !== undefined) {
    message.label = ctx.cleanLabel(rollLabelText(input.kind, input.params ?? {}));
  }
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
