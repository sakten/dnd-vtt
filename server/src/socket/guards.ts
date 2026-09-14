import { isIncapacitated, type CharacterSheet, type Token } from 'shared';
import type { Room } from '../roomTypes';
import type { ConnCtx } from './context';
import { fail } from './errors';
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
  /** Реальный DM или режим тестов комнаты. */
  isDm: boolean;
  /** Заполнено, если токен — персонаж игрока соединения (действия из листа). */
  character: { playerId: string; sheet?: CharacterSheet } | null;
}

export interface ScopeOptions {
  /** Только реальный DM/режим тестов. */
  dmOnly?: boolean;
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
  const isDm = ctx.isDm();
  if (opts.dmOnly && !isDm) return null;
  if (!ctx.canControlToken(room, mapId, token)) return null;
  const playerId = ctx.playerId;
  const character =
    playerId && room.controllers[playerId] === token.libraryItemId
      ? { playerId, sheet: room.sheets[playerId] }
      : null;
  return { room, mapId, token, isDm, character };
}

/** true — открыто окно реакции, действие отклонено (в чат — сообщение, если не silent). */
export function rejectIfReaction(ctx: ConnCtx, silent = false): boolean {
  const room = ctx.getRoom();
  if (!room || !isReactionPending(room.code)) return false;
  if (!silent) fail(ctx, 'reactionPending');
  return true;
}

/** true — существо недееспособно (и это не DM): действие отклонено. */
export function rejectIfIncapacitated(ctx: ConnCtx, token: Token): boolean {
  if (ctx.isDm() || !isIncapacitated(token.conditions)) return false;
  fail(ctx, 'incapacitated');
  return true;
}
