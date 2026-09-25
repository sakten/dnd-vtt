import type { Token } from '../domain/token';

/** Правило «кто контролирует токен»: контролёр по предмету или владелец по имени. */
export interface ControlsTokenInput {
  /** Реальная роль DM/режим тестов. */
  isDm?: boolean;
  /** Игрок соединения. */
  selfId?: string | null;
  /** Текущий персонаж игрока (`libraryItemId` контроллера). */
  currentCharacterId?: string | null;
  /** Имя персонажа игрока для сверки с `token.owner` (пусто — сверка не идёт). */
  charName?: string;
  token: Pick<Token, 'libraryItemId' | 'owner'> & { effects?: Token['effects'] };
  /**
   * id токенов, которыми игрок управляет напрямую (для производного контроля
   * Dominate: цель слушается игрока, пока жив эффект с источником-токеном).
   */
  controlledTokenIds?: Set<string>;
}

export function controlsToken(input: ControlsTokenInput): boolean {
  if (input.isDm) return true;
  if (!input.selfId) return false;
  if (input.currentCharacterId && input.token.libraryItemId === input.currentCharacterId) return true;
  if (input.token.owner && input.charName && input.token.owner === input.charName) return true;
  const ids = input.controlledTokenIds;
  if (ids?.size && input.token.effects?.some((e) => e.dominates && e.sourceId && ids.has(e.sourceId))) {
    return true;
  }
  return false;
}

/** Токен — персонаж игрока (привязка через контроллера): только для него доступен лист. */
export function isCharacterToken(
  currentCharacterId: string | null | undefined,
  token: Pick<Token, 'libraryItemId'>
): boolean {
  return !!currentCharacterId && token.libraryItemId === currentCharacterId;
}
