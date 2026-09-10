import type { LibraryItem, Token } from 'shared';
import { useGameStore } from '../store/useGameStore';

type State = ReturnType<typeof useGameStore.getState>;

export function characterNameOf(s: State, charId: string | null): string {
  if (!charId) return '';
  const map =
    s.scene.maps.find((m) => m.id === s.viewMapId) ??
    s.scene.maps.find((m) => m.tokens.some((t) => t.libraryItemId === charId));
  const placed = map?.tokens.find((t) => t.libraryItemId === charId);
  if (placed) return placed.name;
  return s.library.find((i) => i.id === charId)?.name ?? '';
}

export function canControlWith(s: State, token: Token): boolean {
  if (s.role === 'dm') return true;
  if (!s.selfId) return false;
  if (s.currentCharacterId && token.libraryItemId === s.currentCharacterId) return true;
  if (token.owner) {
    const name = characterNameOf(s, s.currentCharacterId);
    if (name && token.owner === name) return true;
  }
  return false;
}

export function canAddLibraryItemWith(
  s: State,
  item: Pick<LibraryItem, 'id' | 'isPlayerToken' | 'owner'>
): boolean {
  if (s.role === 'dm') return true;
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

export function canAddLibraryItem(item: Pick<LibraryItem, 'id' | 'isPlayerToken' | 'owner'>): boolean {
  return canAddLibraryItemWith(useGameStore.getState(), item);
}

export function canSetAsCharacter(item: Pick<LibraryItem, 'isPlayerToken' | 'owner'>): boolean {
  return item.isPlayerToken && !item.owner.trim();
}
