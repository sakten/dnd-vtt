import type { LibraryItem } from 'shared';
import type { GameState } from '../store/types';
import { characterNameOf, isDmWith } from './control';

/** Видимость предмета библиотеки в меню токенов: автор, свой персонаж или владелец. */
export function canSeeLibraryItemWith(
  s: GameState,
  item: Pick<LibraryItem, 'id' | 'createdBy' | 'owner'>
): boolean {
  if (isDmWith(s)) return true;
  if (!s.selfId) return false;
  if (item.createdBy === s.selfId) return true;
  if (s.currentCharacterId && item.id === s.currentCharacterId) return true;
  const owner = item.owner.trim();
  if (!owner) return false;
  const charName = characterNameOf(s, s.currentCharacterId);
  const playerName = s.players.find((p) => p.id === s.selfId)?.name ?? '';
  return owner === s.selfId || owner === playerName || (!!charName && owner === charName);
}