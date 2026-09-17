import type { LibraryItem, Token } from 'shared';
import { useGameStore } from '../store/useGameStore';
import { activeMapOf, characterTokenOf, tokenById } from '../store/selectors';

type State = ReturnType<typeof useGameStore.getState>;

export function characterNameOf(s: State, charId: string | null): string {
  if (!charId) return '';
  const map =
    activeMapOf(s) ?? s.scene.maps.find((m) => m.tokens.some((t) => t.libraryItemId === charId));
  const placed = characterTokenOf(map, charId);
  if (placed) return placed.name;
  return s.library.find((i) => i.id === charId)?.name ?? '';
}

export function isDmWith(s: Pick<State, 'role' | 'testMode'>): boolean {
  return s.role === 'dm' || s.testMode;
}

/** Хук: эффективные права ведущего (реальная роль DM или режим тестов комнаты). */
export function useIsDm(): boolean {
  return useGameStore((s) => s.role === 'dm' || s.testMode);
}

/** Хук: только реальный DM (режим тестов прав не даёт — например, настройки комнаты). */
export function useIsRealDm(): boolean {
  return useGameStore((s) => s.role === 'dm');
}

type ControlState = Pick<State, 'role' | 'testMode' | 'selfId' | 'currentCharacterId'>;

/**
 * Проверка контроля по минимальному срезу состояния (для мемоизированных предикатов,
 * где нельзя тянуть весь стор): DM/тест — да, свой персонаж или токен с именем персонажа.
 */
export function canControlTokenWith(s: ControlState, token: Token, charName: string): boolean {
  if (isDmWith(s)) return true;
  if (!s.selfId) return false;
  if (s.currentCharacterId && token.libraryItemId === s.currentCharacterId) return true;
  if (token.owner && charName && token.owner === charName) return true;
  return false;
}

/**
 * Токен — персонаж игрока (привязка через контроллера). Только для него доступен
 * лист игрока: серверный `Scope.character` тоже требует `controllers[playerId] === libraryItemId`.
 */
export function isCharacterTokenWith(
  s: Pick<ControlState, 'selfId' | 'currentCharacterId'>,
  token: Token
): boolean {
  return !!s.selfId && s.currentCharacterId !== null && token.libraryItemId === s.currentCharacterId;
}

/** Хук: может завершить текущий ход (DM/тест или контролёр активного токена). */
export function useCanEndTurn(): boolean {
  return useGameStore((s) => {
    if (isDmWith(s)) return true;
    const map = activeMapOf(s);
    const combat = map?.combat;
    const entry = combat && combat.currentIndex >= 0 ? combat.entries[combat.currentIndex] : undefined;
    const token = entry?.tokenId ? tokenById(map, entry.tokenId) : null;
    return token ? canControlWith(s, token) : false;
  });
}

export function canControlWith(s: State, token: Token): boolean {
  return canControlTokenWith(s, token, characterNameOf(s, s.currentCharacterId));
}

export function canAddLibraryItemWith(
  s: State,
  item: Pick<LibraryItem, 'id' | 'isPlayerToken' | 'owner'>
): boolean {
  if (isDmWith(s)) return true;
  if (!s.selfId) return false;
  if (item.isPlayerToken && item.id === s.currentCharacterId) return true;
  if (item.isPlayerToken && item.owner) {
    const name = characterNameOf(s, s.currentCharacterId);
    if (name && item.owner === name) return true;
  }
  return false;
}

export function canControlToken(token: Token): boolean {
  return canControlWith(useGameStore.getState(), token);
}

/** Хук: может ли текущий пользователь управлять токеном. */
export function useCanControl(token: Token): boolean {
  return useGameStore((s) => canControlWith(s, token));
}

/** Хук: может ли текущий пользователь управлять токеном на активной карте по id. */
export function useCanControlId(id: string | null): boolean {
  return useGameStore((s) => {
    const token = tokenById(activeMapOf(s), id);
    return token ? canControlWith(s, token) : false;
  });
}

export function canAddLibraryItem(item: Pick<LibraryItem, 'id' | 'isPlayerToken' | 'owner'>): boolean {
  return canAddLibraryItemWith(useGameStore.getState(), item);
}

export function canSetAsCharacter(item: Pick<LibraryItem, 'isPlayerToken' | 'owner'>): boolean {
  return item.isPlayerToken && !item.owner.trim();
}
