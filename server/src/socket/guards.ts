import { isIncapacitated, type Token } from 'shared';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';
import { isReactionPending } from './reactions';

/** Игрок и его комната (без игрока/комнаты — null). */
export function playerScope(ctx: ConnCtx): { room: Room; playerId: string } | null {
  if (!ctx.playerId) return null;
  const room = ctx.getRoom();
  return room ? { room, playerId: ctx.playerId } : null;
}

export interface Scope {
  room: Room;
  mapId: string;
  token: Token;
}

export interface ScopeOptions {
  /** Только реальный DM/режим тестов. */
  dmOnly?: boolean;
  /** Не проверять права управления (нужны свои проверки). */
  skipControl?: boolean;
}

/**
 * Комната + карта + токен по payload: типы id, поиск токена и (по умолчанию)
 * права контролёра/DM. При любой неудаче — null.
 */
export function scopedToken(ctx: ConnCtx, mapId: unknown, tokenId: unknown, opts: ScopeOptions = {}): Scope | null {
  const room = ctx.getRoom();
  if (!room || typeof mapId !== 'string' || typeof tokenId !== 'string') return null;
  const token = ctx.manager.findToken(room, mapId, tokenId);
  if (!token) return null;
  if (opts.dmOnly) return ctx.isDm() ? { room, mapId, token } : null;
  if (!opts.skipControl && !ctx.canControlToken(room, mapId, token)) return null;
  return { room, mapId, token };
}

/** true — открыто окно реакции, действие отклонено (в чат — сообщение, если не silent). */
export function rejectIfReaction(ctx: ConnCtx, silent = false): boolean {
  const room = ctx.getRoom();
  if (!room || !isReactionPending(room.code)) return false;
  if (!silent) ctx.socket.emit('chat:error', 'Ожидание реакции');
  return true;
}

/** true — существо недееспособно (и это не DM): действие отклонено. */
export function rejectIfIncapacitated(ctx: ConnCtx, token: Token): boolean {
  if (ctx.isDm() || !isIncapacitated(token.conditions)) return false;
  ctx.socket.emit('chat:error', 'Существо недееспособно');
  return true;
}
